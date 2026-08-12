import { gameFrameOptionalFetch, tryGameFrameIdentity } from "./gameframe-auth.js";

const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const CURSOR_KEY = "scribbles-gameframe.cascade-telemetry-cursor:v1";
const SESSION_KEY = "scribbles-gameframe.cascade-play-session:v1";
const FLUSH_INTERVAL_MS = 2_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const ACTIVE_TICK_MS = 1_000;
const IDLE_AFTER_MS = 2 * 60 * 1000;
const NEW_BLOCK_AFTER_MS = 30 * 60 * 1000;
const MAX_BATCH = 5;
const MAX_CLIENT_PAYLOAD_BYTES = 1_800;
const storage = window.localStorage;
const query = new URLSearchParams(window.location.search);
let identity = null;
let flushPending = false;
let lastInputAt = Date.now();
let lastTickAt = Date.now();
let lastPersistAt = 0;

function readJson(key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function analyticsEvents() {
  const value = readJson(ANALYTICS_KEY, []);
  return Array.isArray(value) ? value.filter((event) => event && typeof event === "object") : [];
}

function newSession(now = Date.now()) {
  return {
    sessionId: `cascade-session:${crypto.randomUUID()}`,
    startedAt: now,
    lastInteractionAt: now,
    lastSeenAt: now,
    activeMs: 0,
  };
}

function loadSession() {
  const now = Date.now();
  const value = readJson(SESSION_KEY, null);
  if (
    value
    && typeof value.sessionId === "string"
    && Number.isFinite(Number(value.startedAt))
    && Number.isFinite(Number(value.lastInteractionAt))
    && now - Number(value.lastInteractionAt) < NEW_BLOCK_AFTER_MS
  ) {
    return {
      sessionId: value.sessionId,
      startedAt: Number(value.startedAt),
      lastInteractionAt: Number(value.lastInteractionAt),
      lastSeenAt: now,
      activeMs: Math.max(0, Number(value.activeMs) || 0),
    };
  }
  return newSession(now);
}

let session = loadSession();

function persistSession(force = false) {
  const now = Date.now();
  if (!force && now - lastPersistAt < 5_000) return;
  session.lastSeenAt = now;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
  lastPersistAt = now;
}

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function eventTimestamp(event) {
  const value = Date.parse(String(event?.at || ""));
  return Number.isFinite(value) ? value : null;
}

function payloadFor(event) {
  const complete = { ...event };
  if (JSON.stringify(complete).length <= MAX_CLIENT_PAYLOAD_BYTES) return complete;
  const compact = { telemetryPayloadTruncated: true };
  for (const key of [
    "at", "type", "mode", "level", "score", "movesRemaining", "target", "moves", "hard", "difficulty", "chapter",
    "from", "to", "matched", "cascade", "gained", "specialCreated", "specialTriggered", "combo", "iceHits",
    "bonus", "streak", "stars", "bestStars", "totalStars", "lives", "booster", "armed", "savedAt", "id", "seconds",
    "bestScore", "matches", "specials", "cascades",
  ]) {
    if (Object.hasOwn(event, key)) compact[key] = event[key];
  }
  return compact;
}

function enrichRawEvents(events) {
  const duplicateCounts = new Map();
  let historicalSessionId = null;
  let previousAt = null;
  let activeAttemptId = null;
  let activeAttemptMode = null;

  return events.map((event) => {
    const fingerprint = JSON.stringify(event);
    const occurrence = duplicateCounts.get(fingerprint) || 0;
    duplicateCounts.set(fingerprint, occurrence + 1);
    const eventId = `cascade-raw:${fnv1a(fingerprint)}:${occurrence}`;
    const timestamp = eventTimestamp(event);

    let sessionId = session.sessionId;
    if (timestamp !== null && timestamp < session.startedAt - 1_000) {
      if (previousAt === null || timestamp - previousAt >= NEW_BLOCK_AFTER_MS || !historicalSessionId) {
        historicalSessionId = `cascade-history:${new Date(timestamp).toISOString()}`;
      }
      sessionId = historicalSessionId;
      previousAt = timestamp;
    }

    const mode = typeof event.mode === "string" ? event.mode : "normal";
    if (event.type === "level_start") {
      activeAttemptId = `cascade-attempt:${eventId}`;
      activeAttemptMode = mode;
    } else if (event.type === "level_resume" && !activeAttemptId) {
      activeAttemptId = `cascade-attempt:${eventId}`;
      activeAttemptMode = mode;
    } else if (event.type === "blitz_start") {
      activeAttemptId = `cascade-blitz:${eventId}`;
      activeAttemptMode = "blitz";
    }

    const attemptId = activeAttemptId && activeAttemptMode === mode ? activeAttemptId : null;
    const enriched = {
      eventId,
      at: timestamp === null ? new Date().toISOString() : new Date(timestamp).toISOString(),
      type: String(event.type || "unknown"),
      sessionId,
      attemptId,
      payload: payloadFor(event),
    };

    if (event.type === "level_win" || event.type === "level_failed" || event.type === "blitz_complete") {
      activeAttemptId = null;
      activeAttemptMode = null;
    }
    return enriched;
  });
}

async function postEvents(events, { keepalive = false } = {}) {
  if (!identity || !events.length) return false;
  const response = await gameFrameOptionalFetch("/api/me/cascade/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events }),
    keepalive,
  }, identity);
  if (response.status === 401) identity = null;
  return response.ok;
}

async function flushRawEvents() {
  if (!identity || flushPending) return;
  flushPending = true;
  try {
    for (let round = 0; round < 32; round += 1) {
      const enriched = enrichRawEvents(analyticsEvents());
      if (!enriched.length) return;
      const cursor = storage.getItem(CURSOR_KEY);
      const cursorIndex = cursor ? enriched.findIndex((event) => event.eventId === cursor) : -1;
      const pending = enriched.slice(cursorIndex + 1, cursorIndex + 1 + MAX_BATCH);
      if (!pending.length) return;
      if (!await postEvents(pending)) return;
      storage.setItem(CURSOR_KEY, pending[pending.length - 1].eventId);
      if (pending.length < MAX_BATCH) return;
    }
  } catch {
    // Playtest telemetry is deliberately failure-isolated from gameplay.
  } finally {
    flushPending = false;
  }
}

function syntheticEvent(type, payload = {}) {
  const at = new Date().toISOString();
  return {
    eventId: `${session.sessionId}:${type}:${fnv1a(`${at}:${JSON.stringify(payload)}`)}`,
    at,
    type,
    sessionId: session.sessionId,
    attemptId: null,
    payload: {
      mode: "telemetry",
      activeMs: Math.round(session.activeMs),
      ...payload,
    },
  };
}

async function sendSessionEvent(type, payload = {}, options = {}) {
  if (!identity) return;
  try {
    await postEvents([syntheticEvent(type, payload)], options);
  } catch {
    // Session timing is best-effort and must never interrupt gameplay.
  }
}

async function rotateSession(now = Date.now()) {
  await sendSessionEvent("telemetry_session_end", { reason: "inactivity" }, { keepalive: true });
  session = newSession(now);
  lastInputAt = now;
  lastTickAt = now;
  persistSession(true);
  await sendSessionEvent("telemetry_session_start", { reason: "return_after_inactivity" });
}

function noteInteraction() {
  const now = Date.now();
  if (now - session.lastInteractionAt >= NEW_BLOCK_AFTER_MS) {
    session.lastInteractionAt = now;
    void rotateSession(now);
    return;
  }
  session.lastInteractionAt = now;
  lastInputAt = now;
  persistSession();
}

function tickActiveTime() {
  const now = Date.now();
  const elapsed = Math.max(0, Math.min(ACTIVE_TICK_MS * 2, now - lastTickAt));
  if (!document.hidden && now - lastInputAt <= IDLE_AFTER_MS) {
    session.activeMs += elapsed;
  }
  session.lastSeenAt = now;
  lastTickAt = now;
  persistSession();
}

async function start() {
  identity = await tryGameFrameIdentity({
    preferredDevelopmentPlayerId: query.get("player"),
  });
  if (!identity) return;

  persistSession(true);
  await sendSessionEvent("telemetry_session_start", {
    reason: "page_open",
    path: window.location.pathname,
  });
  await flushRawEvents();

  for (const eventName of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(eventName, noteInteraction, { passive: true });
  }

  window.setInterval(tickActiveTime, ACTIVE_TICK_MS);
  window.setInterval(() => void flushRawEvents(), FLUSH_INTERVAL_MS);
  window.setInterval(() => {
    void sendSessionEvent("telemetry_session_heartbeat", {
      visible: !document.hidden,
      idle: Date.now() - lastInputAt > IDLE_AFTER_MS,
    });
  }, HEARTBEAT_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    lastTickAt = Date.now();
    if (document.hidden) {
      persistSession(true);
      void flushRawEvents();
      void sendSessionEvent("telemetry_session_heartbeat", { visible: false }, { keepalive: true });
    } else {
      noteInteraction();
      void flushRawEvents();
    }
  });

  window.addEventListener("pagehide", () => {
    tickActiveTime();
    persistSession(true);
    void flushRawEvents();
    void sendSessionEvent("telemetry_session_end", { reason: "pagehide" }, { keepalive: true });
  });
}

void start();
