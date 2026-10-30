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

function harness({ requests = [], offline = false, cursorFails = false, sessionFails = false } = {}) {
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
      if ((cursorFails && key === CURSOR_KEY) || (sessionFails && key === "scribbles-gameframe.cascade-play-session:v1")) {
        throw new Error("QuotaExceededError");
      }
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
      const events = JSON.parse(options.body).events;
      network.requests.push(events);
      if (typeof network.onPost === "function") await network.onPost(events, values);
      return { ok: network.okay, status: network.okay ? 200 : 503 };
    },
    tryGameFrameIdentity: async () => ({ playerId: "alice" }),
  });
  vm.runInContext(code, sandbox, { filename: "cascade-telemetry-sync.js" });
  vm.runInContext("identity = { playerId: 'alice' };", sandbox);
  const run = (expression) => vm.runInContext(expression, sandbox);
  return { values, clock, network, subscribers, run };
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

test("shared cursor advances in another tab supersede the previous local cursor", async () => {
  const env = harness();
  const events = [1, 2, 3, 4].map((n) =>
    raw(n, String(n).repeat(8) + "-1111-4111-8111-" + String(n).repeat(12)));
  env.values.set(ANALYTICS_KEY, JSON.stringify(events.slice(0, 1)));
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 1);
  // Simulate another tab uploading the middle events after this tab set its
  // own volatile cursor. The next flush must send only the unseen tail.
  env.values.set(ANALYTICS_KEY, JSON.stringify(events));
  env.values.set(CURSOR_KEY, "cascade-raw:" + events[2].telemetryId);
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 2);
  assert.deepEqual(
    Array.from(env.network.requests[1], (e) => e.eventId),
    ["cascade-raw:" + events[3].telemetryId],
  );
  assert.equal(env.values.get(CURSOR_KEY), "cascade-raw:" + events[3].telemetryId);
});

test("concurrent tab acknowledgement during POST must not regress shared cursor", async () => {
  const env = harness();
  const events = Array.from({ length: 7 }, (_, i) => raw(i + 1,
    String(i + 1).repeat(8) + "-1111-4111-8111-" + String(i + 1).repeat(12)));
  env.values.set(ANALYTICS_KEY, JSON.stringify(events.slice(0, 1)));
  await env.run("flushRawEvents()");
  env.values.set(ANALYTICS_KEY, JSON.stringify(events));
  env.network.onPost = (_, shared) => shared.set(CURSOR_KEY,
    "cascade-raw:" + events[6].telemetryId);
  await env.run("flushRawEvents()");
  // This page sent 2–6, while a different tab acknowledged 7. The second
  // page must not replace cursor 7 with its older acknowledgement for 6.
  assert.equal(env.network.requests.length, 2);
  assert.equal(env.network.requests[1].length, 5);
  assert.equal(env.values.get(CURSOR_KEY), "cascade-raw:" + events[6].telemetryId);
  env.network.onPost = null;
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 2);
});

test("a concurrent tab's cursor outside the in-flight snapshot must not be overwritten", async () => {
  const env = harness();
  const [a, b, c] = [1, 2, 3].map((n) => raw(n,
    String(n).repeat(8) + "-1111-4111-8111-" + String(n).repeat(12)));
  env.values.set(ANALYTICS_KEY, JSON.stringify([a]));
  env.network.onPost = (_, shared) => {
    // A separate tab may rotate the bounded history and acknowledge its
    // first new event while this tab still awaits a POST of evicted data.
    shared.set(ANALYTICS_KEY, JSON.stringify([b, c]));
    shared.set(CURSOR_KEY, "cascade-raw:" + b.telemetryId);
  };
  await env.run("flushRawEvents()");
  assert.equal(env.values.get(CURSOR_KEY), "cascade-raw:" + b.telemetryId);
  env.network.onPost = null;
  await env.run("flushRawEvents()");
  assert.deepEqual(
    Array.from(env.network.requests[1], (item) => item.eventId),
    ["cascade-raw:" + c.telemetryId],
    "the already acknowledged event from the other tab is not replayed",
  );
});

test("evicted cursor replays only the finite retained window and eventually drains", async () => {
  const env = harness();
  const events = Array.from({ length: 501 }, (_, index) => raw(index,
    "11111111-1111-4111-8111-" + String(index).padStart(12, "0")));
  env.values.set(ANALYTICS_KEY, JSON.stringify([events[0]]));
  await env.run("flushRawEvents()");
  assert.equal(env.values.get(CURSOR_KEY), "cascade-raw:" + events[0].telemetryId);
  env.network.requests.length = 0;

  // The acknowledged cursor fell out of the 500-item local ring.
  env.values.set(ANALYTICS_KEY, JSON.stringify(events.slice(1)));
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 32, "one invocation has a finite request budget");
  for (let i = 0; i < 3; i += 1) await env.run("flushRawEvents()");
  const uploaded = env.network.requests.flat().map((item) => item.eventId);
  assert.equal(uploaded.length, 500);
  assert.equal(new Set(uploaded).size, 500, "no retained event is replayed twice");
  assert.equal(uploaded[0], "cascade-raw:" + events[1].telemetryId);
  assert.equal(env.values.get(CURSOR_KEY), "cascade-raw:" + events[500].telemetryId);
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.flat().length, 500);
});

test("rapid reconnect flaps cannot bypass minimum spacing for newly queued events", async () => {
  const env = harness();
  await env.run("start()");
  env.network.requests.length = 0; // Ignore the best-effort page-open marker.
  const first = raw(1, "11111111-1111-4111-8111-111111111111");
  const second = raw(2, "22222222-2222-4222-8222-222222222222");
  env.values.set(ANALYTICS_KEY, JSON.stringify([first]));
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 1);
  env.values.set(ANALYTICS_KEY, JSON.stringify([first, second]));
  for (let i = 0; i < 5; i += 1) {
    env.network.offline = true;
    env.subscribers.get("offline")();
    env.network.offline = false;
    env.subscribers.get("online")();
  }
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 1, "network flapping cannot force another POST immediately");
  env.clock.now += 14_999;
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 1);
  env.clock.now += 1;
  await env.run("flushRawEvents()");
  assert.equal(env.network.requests.length, 2);
  assert.equal(env.network.requests[1][0].eventId, "cascade-raw:" + second.telemetryId);
});

test("session-storage quota errors stay isolated from play and event handlers", async () => {
  const env = harness({ sessionFails: true });
  await env.run("start()");
  env.run("noteInteraction()");
  env.run("tickActiveTime()");
  assert.equal(env.subscribers.has("pointerdown"), true);
  assert.equal(env.subscribers.has("pagehide"), true);
  assert.equal(env.values.has("scribbles-gameframe.cascade-play-session:v1"), false);
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
