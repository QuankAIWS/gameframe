import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const ROOT = new URL("../../../", import.meta.url);
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const CURSOR_KEY = "scribbles-gameframe.cascade-telemetry-cursor:v1";
const base = await readFile(new URL("public/cascade-telemetry-sync.js", ROOT), "utf8");
const code = base
  .replace(/^import \{ gameFrameOptionalFetch, tryGameFrameIdentity \} from "\.\/gameframe-auth\.js";\n/, "")
  .replace(/\nvoid start\(\);\s*$/, "\n");
assert.ok(code.includes("function enrichRawEvents"), "test must exercise live browser module");
assert.ok(!code.includes("void start();"), "module auto-start must be isolated");

function harness({ requests = [], offline = false, cursorFails = false } = {}) {
  const values = new Map();
  const clock = { now: Date.parse("2026-10-24T17:00:00Z") };
  const subscribers = new Map();
  class ControlledDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  }
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (cursorFails && key === CURSOR_KEY) throw new Error("QuotaExceededError");
      values.set(key, String(value));
    },
  };
  const network = { offline, requests, okay: true };
  const window = {
    localStorage: storage,
    location: { search: "", pathname: "/cascade.html" },
    navigator: { get onLine() { return !network.offline; } },
    addEventListener: (type, handler) => subscribers.set(type, handler),
    setInterval: () => 1,
  };
  const sandbox = vm.createContext({
    window,
    document: { hidden: false, addEventListener: () => {} },
    URLSearchParams,
    Date: ControlledDate,
    crypto: { randomUUID: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    gameFrameOptionalFetch: async (url, options) => {
      network.requests.push(JSON.parse(options.body).events);
      return { ok: network.okay, status: network.okay ? 200 : 503 };
    },
    tryGameFrameIdentity: async () => ({ playerId: "alice" }),
  });
  vm.runInContext(code, sandbox, { filename: "cascade-telemetry-sync.js" });
  vm.runInContext("identity = { playerId: 'alice' };", sandbox);
  const run = (expression) => vm.runInContext(expression, sandbox);
  return { values, clock, network, run };
}

function raw(number, telemetryId) {
  return {
    type: "level_start",
    mode: "normal",
    level: 21,
    at: "2026-10-24T16:59:00.000Z",
    ...(telemetryId ? { telemetryId } : {}),
    // Deliberately identical gameplay fields to exercise eviction/replay.
    score: 0,
  };
}

test("durable raw IDs remain unchanged after the 500-item queue evicts identical older events", () => {
  const env = harness();
  const a = raw(1, "11111111-1111-4111-8111-111111111111");
  const b = raw(2, "22222222-2222-4222-8222-222222222222");
  const c = raw(3, "33333333-3333-4333-8333-333333333333");
  env.values.set(ANALYTICS_KEY, JSON.stringify([a, b, c]));
  const prior = env.run("enrichRawEvents(analyticsEvents())");
  env.values.set(ANALYTICS_KEY, JSON.stringify([b, c]));
  const later = env.run("enrichRawEvents(analyticsEvents())");
  assert.equal(prior[1].eventId, later[0].eventId);
  assert.equal(prior[2].eventId, later[1].eventId);
  assert.notEqual(later[0].eventId, later[1].eventId);
  assert.equal(later[0].eventId, "cascade-raw:22222222-2222-4222-8222-222222222222");

  // Existing local events before upgrade retain the legacy encoding.
  const legacy = env.run("enrichRawEvents([" + JSON.stringify(raw(1)) + "," + JSON.stringify(raw(2)) + "])");
  assert.notEqual(legacy[0].eventId, legacy[1].eventId);
});

test("malformed oversized history is still bounded to the newest 500 raw events", () => {
  const env = harness();
  const rawEvents = Array.from({ length: 510 }, (_, i) => ({
    at: "2026-10-24T16:59:00.000Z", type: "level_start", level: i,
    telemetryId: "11111111-1111-4111-8111-" + String(i).padStart(12, "0"),
  }));
  env.values.set(ANALYTICS_KEY, JSON.stringify(rawEvents));
  const retained = env.run("analyticsEvents()");
  assert.equal(retained.length, 500);
  assert.equal(retained[0].level, 10);
  assert.equal(retained.at(-1).level, 509);
});

test("network rejection backs off instead of posting every two-second flush", async () => {
  const env = harness();
  const event = raw(1, "11111111-1111-4111-8111-111111111111");
  env.values.set(ANALYTICS_KEY, JSON.stringify([event]));
  env.network.okay = false;
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 1);
  assert.equal(env.values.get(CURSOR_KEY), undefined);
  env.clock.now += 2_000;
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 1, "no retry after only 2 seconds");
  env.clock.now += 14_000;
  env.network.okay = true;
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 2);
  assert.equal(env.values.get(CURSOR_KEY), "cascade-raw:11111111-1111-4111-8111-111111111111");
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 2, "acknowledged events do not post again");
});

test("offline gating and quota-failed cursor persistence do not loop requests", async () => {
  const env = harness({ offline: true, cursorFails: true });
  env.values.set(ANALYTICS_KEY, JSON.stringify([raw(1, "11111111-1111-4111-8111-111111111111")]));
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 0);
  env.network.offline = false;
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 1);
  // The server accepted the event, but the cursor could not be persisted.
  // In-memory custody still prevents repeated sends within this page load.
  env.clock.now += 60_000;
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 1);
});

test("every analytics producer saves a bounded queue and a durable UUID", async () => {
  for (const path of [
    "public/cascade.js",
    "public/cascade-runtime-v2.js",
    "public/cascade-bonus-modes.js",
    "public/cascade-tutorial.js",
  ]) {
    const source = await readFile(new URL(path, ROOT), "utf8");
    assert.ok(source.includes("telemetryId: crypto.randomUUID()"), path);
    assert.ok(source.includes("events.slice(-500)"), path);
  }
});
