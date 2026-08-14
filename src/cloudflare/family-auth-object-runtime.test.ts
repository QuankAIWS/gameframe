import assert from "node:assert/strict";
import test from "node:test";
import { FamilyAuthObjectRuntime } from "./family-auth-object-runtime.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T): Promise<void> { this.values.set(key, structuredClone(value)); }
}

function request(path: string, method = "GET", value?: unknown) {
  return new Request(`https://family.internal${path}`, {
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

test("family enrollment requires approval and can only be claimed once", async () => {
  const runtime = new FamilyAuthObjectRuntime(new MemoryStorage());
  const now = Date.now();
  const enrollment = {
    requestId: "request-1",
    claimHash: "a".repeat(64),
    playerId: "discord:mother",
    displayName: "Mom",
    deviceLabel: "iPad GameFrame app",
    code: "482731",
    createdAt: now,
    expiresAt: now + 600_000,
  };

  assert.equal((await runtime.fetch(request("/family/enroll", "POST", enrollment))).status, 200);

  const before = await body(await runtime.fetch(request("/family/claim", "POST", {
    requestId: enrollment.requestId,
    claimHash: enrollment.claimHash,
  })));
  assert.equal(before.status, "pending");

  const approval = await body(await runtime.fetch(request("/family/approve", "POST", {
    requestId: enrollment.requestId,
    approvedBy: "discord:admin",
  })));
  assert.equal(approval.approved, true);

  const claimed = await body(await runtime.fetch(request("/family/claim", "POST", {
    requestId: enrollment.requestId,
    claimHash: enrollment.claimHash,
  })));
  assert.equal(claimed.status, "approved");
  assert.equal(claimed.playerId, "discord:mother");
  assert.equal(claimed.approvedBy, "discord:admin");

  const replay = await body(await runtime.fetch(request("/family/claim", "POST", {
    requestId: enrollment.requestId,
    claimHash: enrollment.claimHash,
  })));
  assert.equal(replay.status, "unavailable");
});

test("trusted devices verify by hashed secret and can be revoked independently", async () => {
  const runtime = new FamilyAuthObjectRuntime(new MemoryStorage());
  const now = Date.now();
  const device = {
    deviceId: "device-1",
    secretHash: "b".repeat(64),
    playerId: "discord:mother",
    displayName: "Mom",
    deviceLabel: "iPad GameFrame app",
    createdAt: now,
    lastUsedAt: now,
    expiresAt: now + 86_400_000,
    approvedBy: "discord:admin",
  };

  await runtime.fetch(request("/family/device/issue", "POST", device));
  const wrong = await body(await runtime.fetch(request("/family/device/verify", "POST", {
    deviceId: device.deviceId,
    secretHash: "c".repeat(64),
  })));
  assert.equal(wrong.authenticated, false);

  const valid = await body(await runtime.fetch(request("/family/device/verify", "POST", {
    deviceId: device.deviceId,
    secretHash: device.secretHash,
  })));
  assert.equal(valid.authenticated, true);
  assert.equal(valid.playerId, device.playerId);

  const listed = await body(await runtime.fetch(request("/family/devices")));
  assert.equal(listed.devices.length, 1);
  assert.equal("secretHash" in listed.devices[0], false);

  await runtime.fetch(request("/family/device/revoke", "POST", { deviceId: device.deviceId }));
  const revoked = await body(await runtime.fetch(request("/family/device/verify", "POST", {
    deviceId: device.deviceId,
    secretHash: device.secretHash,
  })));
  assert.equal(revoked.authenticated, false);
});

test("pending enrollment listings never expose claim hashes", async () => {
  const runtime = new FamilyAuthObjectRuntime(new MemoryStorage());
  const now = Date.now();
  await runtime.fetch(request("/family/enroll", "POST", {
    requestId: "request-visible",
    claimHash: "d".repeat(64),
    playerId: "discord:father",
    displayName: "Dad",
    deviceLabel: "Windows GameFrame app",
    code: "102938",
    createdAt: now,
    expiresAt: now + 600_000,
  }));
  const listed = await body(await runtime.fetch(request("/family/enrollments")));
  assert.equal(listed.requests.length, 1);
  assert.equal("claimHash" in listed.requests[0], false);
  assert.equal(listed.requests[0].code, "102938");
});
