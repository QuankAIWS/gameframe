import assert from "node:assert/strict";
import test from "node:test";
import { CascadeDiagnosticsObjectRuntime } from "./cascade-diagnostics-object-runtime.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T): Promise<void> { this.values.set(key, structuredClone(value)); }
}

function request(path: string, method = "GET", value?: unknown) {
  return new Request(`https://player.internal${path}`, {
    method,
    ...(value === undefined ? {} : {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    }),
  });
}

async function body(response: Response) {
  return response.json() as Promise<any>;
}

function incident(index: number) {
  return {
    incidentId: `incident-${index}`,
    at: new Date(Date.UTC(2026, 7, 23, 22, 0, index % 60)).toISOString(),
    type: index % 2 ? "abrupt_renderer_recovery" : "javascript_error",
    payload: {
      previousLastVfx: { activeParticles: 360, visibleEffectGroups: 28 },
      device: { viewport: { width: 390, height: 844 }, dpr: 3 },
    },
  };
}

test("Cascade diagnostics deduplicate incidents and keep only the newest bounded ring", async () => {
  const runtime = new CascadeDiagnosticsObjectRuntime(new MemoryStorage());
  const incidents = Array.from({ length: 48 }, (_, index) => incident(index));

  for (let offset = 0; offset < incidents.length; offset += 8) {
    const result = await body(await runtime.fetch(request("/diagnostics/cascade/ingest", "POST", {
      incidents: incidents.slice(offset, offset + 8),
    })));
    assert.equal(result.retentionDays, 30);
    assert.ok(result.storedIncidents <= 40);
  }

  const duplicate = await body(await runtime.fetch(request("/diagnostics/cascade/ingest", "POST", {
    incidents: [incidents[47]],
  })));
  assert.equal(duplicate.accepted, 0);
  assert.equal(duplicate.duplicates, 1);

  const exported = await body(await runtime.fetch(request("/diagnostics/cascade/export")));
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.retentionDays, 30);
  assert.equal(exported.maxStoredIncidents, 40);
  assert.equal(exported.incidents.length, 40);
  assert.equal(exported.incidents.at(-1).incidentId, "incident-47");
  assert.equal(exported.incidents.some((value: any) => value.incidentId === "incident-0"), false);
});

test("Cascade diagnostics reject oversized batches instead of becoming a telemetry firehose", async () => {
  const runtime = new CascadeDiagnosticsObjectRuntime(new MemoryStorage());
  const response = await runtime.fetch(request("/diagnostics/cascade/ingest", "POST", {
    incidents: Array.from({ length: 9 }, (_, index) => incident(index)),
  }));
  assert.equal(response.status, 400);
  const value = await body(response);
  assert.equal(value.error, "cascade_diagnostics_invalid");
});
