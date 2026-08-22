import { gameFrameOptionalFetch, tryGameFrameIdentity } from "./gameframe-auth.js";

const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const LEGACY_CURSOR_KEY = "scribbles-gameframe.cascade-telemetry-cursor:v1";
const MIGRATION_KEY = "scribbles-gameframe.cascade-telemetry-migrated:v2";
const SESSION_KEY = "scribbles-gameframe.cascade-play-session:v1";
const RUN_STATE_KEY = "scribbles-gameframe.cascade-telemetry-runs:v2";
const HEALTH_KEY = "scribbles-gameframe.cascade-telemetry-health:v2";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const CASCADE_STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const FALLBACK_OUTBOX_KEY = "scribbles-gameframe.cascade-telemetry-outbox-fallback:v2";
const TELEMETRY_DB = "scribbles-gameframe-cascade-telemetry-v2";
const TELEMETRY_STORE = "events";
const TELEMETRY_SCHEMA_VERSION = 2;
const RULES_VERSION = "cascade-rules-v2";
const FLUSH_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1_000;
const ACTIVE_TICK_MS = 1_000;
const IDLE_AFTER_MS = 2 * 60 * 1000;
const NEW_BLOCK_AFTER_MS = 30 * 60 * 1000;
const MAX_BATCH_EVENTS = 24;
const MAX_BATCH_BYTES = 14_000;
const MAX_CLIENT_PAYLOAD_BYTES = 1_800;
const FALLBACK_OUTBOX_LIMIT = 1_000;
const storage = window.localStorage;
const query = new URLSearchParams(window.location.search);
const nativeSetItem = Storage.prototype.setItem;
let identity = null;
let flushPending = false;
let migrationPending = false;
let lastInputAt = Date.now();
let lastTickAt = Date.now();
let lastPersistAt = 0;
let dbPromise = null;
let pendingSwapContext = null;
let clickSelection = null;
let lastPointer = null;
let recallRound = null;
let recallDialogObserver = null;

function readJson(key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonNative(key, value) {
  try {
    nativeSetItem.call(storage, key, JSON.stringify(value));
  } catch {
    // Telemetry state is best effort and must never interrupt gameplay.
  }
}

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function uuid(prefix) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function eventTimestamp(event) {
  const value = Date.parse(String(event?.at || ""));
  return Number.isFinite(value) ? value : null;
}

function newSession(now = Date.now()) {
  return {
    sessionId: uuid("cascade-session"),
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
let runState = readJson(RUN_STATE_KEY, { normal: null, blitz: null, recall: null, lastBlitzOffer: null });
let health = {
  generated: 0,
  accepted: 0,
  duplicates: 0,
  rejected: 0,
  uploadAttempts: 0,
  uploadFailures: 0,
  outboxWriteFailures: 0,
  fallbackDrops: 0,
  payloadTruncated: 0,
  ...readJson(HEALTH_KEY, {}),
};

function persistSession(force = false) {
  const now = Date.now();
  if (!force && now - lastPersistAt < 5_000) return;
  session.lastSeenAt = now;
  writeJsonNative(SESSION_KEY, session);
  lastPersistAt = now;
}

function persistRunState() {
  writeJsonNative(RUN_STATE_KEY, runState);
}

function persistHealth() {
  writeJsonNative(HEALTH_KEY, health);
}

function makeRun(mode, detail = {}) {
  return {
    attemptId: uuid(`cascade-${mode}`),
    mode,
    level: Number(detail.level) || null,
    startedAt: Date.now(),
    activeMs: 0,
    startedEventSeen: false,
    phase: detail.phase || "active",
    initialBoard: Array.isArray(detail.initialBoard) ? detail.initialBoard.slice() : null,
    initialSpecials: Array.isArray(detail.initialSpecials) ? detail.initialSpecials.slice() : null,
    initialRngState: Number(detail.initialRngState) || null,
    offer: detail.offer || null,
  };
}

function recoverNormalRunFromSavedState() {
  if (runState.normal?.attemptId) return;
  const saved = readJson(ACTIVE_RUN_KEY, null);
  if (!saved || !Array.isArray(saved.board)) return;
  runState.normal = makeRun("attempt", {
    level: saved.level,
    initialBoard: saved.board,
    initialSpecials: saved.specials,
    initialRngState: saved.rngState,
  });
  if (typeof saved.telemetryAttemptId === "string") runState.normal.attemptId = saved.telemetryAttemptId;
  if (Number.isFinite(Number(saved.telemetryStartedAt))) runState.normal.startedAt = Number(saved.telemetryStartedAt);
  if (Number.isFinite(Number(saved.telemetryActiveMs))) runState.normal.activeMs = Math.max(0, Number(saved.telemetryActiveMs));
  persistRunState();
}

recoverNormalRunFromSavedState();

function activeRunForMode(mode) {
  if (mode === "blitz") return runState.blitz;
  if (mode === "bonus") return runState.recall;
  return runState.normal;
}

function setActiveRunForMode(mode, value) {
  if (mode === "blitz") runState.blitz = value;
  else if (mode === "bonus") runState.recall = value;
  else runState.normal = value;
  persistRunState();
}

function initialRunSnapshot() {
  const saved = readJson(ACTIVE_RUN_KEY, null);
  if (!saved || !Array.isArray(saved.board)) return {};
  return {
    initialBoard: saved.board.slice(),
    initialSpecials: Array.isArray(saved.specials) ? saved.specials.slice() : null,
    initialRngState: Number(saved.rngState) || null,
  };
}

function ensureNormalRun(level, forceNew = false) {
  if (forceNew || !runState.normal?.attemptId || (level && Number(runState.normal.level) !== Number(level))) {
    runState.normal = makeRun("attempt", { level, ...initialRunSnapshot() });
    persistRunState();
  }
  return runState.normal;
}

function browserFamily() {
  const ua = navigator.userAgent || "";
  if (/Edg\//.test(ua)) return "edge";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "safari";
  return "other";
}

function clientContext() {
  return {
    telemetrySchemaVersion: TELEMETRY_SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    browser: browserFamily(),
    platform: navigator.userAgentData?.platform || navigator.platform || null,
    language: navigator.language || null,
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    touchPoints: navigator.maxTouchPoints || 0,
    coarsePointer: window.matchMedia?.("(pointer: coarse)")?.matches ?? false,
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false,
  };
}

function payloadFor(event) {
  const {
    eventId: _eventId,
    attemptId: _attemptId,
    sessionId: _sessionId,
    queuedAt: _queuedAt,
    ...complete
  } = event;
  if (JSON.stringify(complete).length <= MAX_CLIENT_PAYLOAD_BYTES) return complete;
  health.payloadTruncated += 1;
  persistHealth();
  const compact = { telemetryPayloadTruncated: true };
  for (const key of [
    "at", "type", "mode", "level", "score", "movesRemaining", "target", "moves", "hard", "difficulty", "chapter",
    "from", "to", "inputMethod", "invalidReason", "matched", "cascade", "gained", "specialCreated", "specialTriggered",
    "combo", "iceHits", "bonus", "streak", "stars", "bestStars", "totalStars", "lives", "booster", "armed", "savedAt",
    "id", "seconds", "bestScore", "matches", "specials", "cascades", "activeAttemptMs", "initialRngState", "rulesVersion",
    "telemetrySchemaVersion", "resource", "direction", "amount", "balanceBefore", "balanceAfter", "reason", "afterLevel",
    "accuracy", "correct", "total", "perfectRounds", "round", "sequenceLength", "firstInputMs", "responseMs", "phase",
  ]) {
    if (Object.hasOwn(complete, key)) compact[key] = complete[key];
  }
  return compact;
}

function wireEvent(event) {
  const timestamp = eventTimestamp(event);
  return {
    eventId: String(event.eventId || uuid("cascade-event")),
    at: timestamp === null ? new Date().toISOString() : new Date(timestamp).toISOString(),
    type: String(event.type || "unknown"),
    sessionId: typeof event.sessionId === "string" ? event.sessionId : session.sessionId,
    attemptId: typeof event.attemptId === "string" ? event.attemptId : null,
    payload: payloadFor(event),
  };
}

function openTelemetryDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(TELEMETRY_DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.createObjectStore(TELEMETRY_STORE, { keyPath: "eventId" });
        store.createIndex("queuedAt", "queuedAt");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Telemetry IndexedDB unavailable."));
    });
  }
  return dbPromise;
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Telemetry IndexedDB operation failed."));
  });
}

async function putIndexed(event) {
  const db = await openTelemetryDb();
  const tx = db.transaction(TELEMETRY_STORE, "readwrite");
  tx.objectStore(TELEMETRY_STORE).put({ ...event, queuedAt: Number(event.queuedAt) || Date.now() });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Telemetry outbox write failed."));
    tx.onabort = () => reject(tx.error || new Error("Telemetry outbox write aborted."));
  });
}

function fallbackOutbox() {
  const value = readJson(FALLBACK_OUTBOX_KEY, []);
  return Array.isArray(value) ? value : [];
}

function putFallback(event) {
  const values = fallbackOutbox();
  const next = values.filter((value) => value?.eventId !== event.eventId);
  next.push({ ...event, queuedAt: Number(event.queuedAt) || Date.now() });
  if (next.length > FALLBACK_OUTBOX_LIMIT) {
    health.fallbackDrops += next.length - FALLBACK_OUTBOX_LIMIT;
    next.splice(0, next.length - FALLBACK_OUTBOX_LIMIT);
  }
  writeJsonNative(FALLBACK_OUTBOX_KEY, next);
  persistHealth();
}

async function enqueueWire(value, countGenerated = true) {
  const event = { ...value, queuedAt: Number(value.queuedAt) || Date.now() };
  if (countGenerated) {
    health.generated += 1;
    persistHealth();
  }
  try {
    await putIndexed(event);
  } catch {
    health.outboxWriteFailures += 1;
    persistHealth();
    putFallback(event);
  }
}

async function listIndexed(limit) {
  const db = await openTelemetryDb();
  const tx = db.transaction(TELEMETRY_STORE, "readonly");
  const index = tx.objectStore(TELEMETRY_STORE).index("queuedAt");
  return new Promise((resolve, reject) => {
    const values = [];
    const request = index.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || values.length >= limit) {
        resolve(values);
        return;
      }
      values.push(cursor.value);
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error("Telemetry outbox read failed."));
  });
}

async function deleteIndexed(ids) {
  if (!ids.length) return;
  try {
    const db = await openTelemetryDb();
    const tx = db.transaction(TELEMETRY_STORE, "readwrite");
    const store = tx.objectStore(TELEMETRY_STORE);
    ids.forEach((id) => store.delete(id));
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Telemetry outbox delete failed."));
      tx.onabort = () => reject(tx.error || new Error("Telemetry outbox delete aborted."));
    });
  } catch {
    // Fallback cleanup below still runs.
  }
}

async function pendingEvents(limit = MAX_BATCH_EVENTS) {
  let indexed = [];
  try {
    indexed = await listIndexed(limit);
  } catch {
    indexed = [];
  }
  if (indexed.length >= limit) return indexed;
  const ids = new Set(indexed.map((event) => event.eventId));
  const fallback = fallbackOutbox()
    .filter((event) => event?.eventId && !ids.has(event.eventId))
    .sort((left, right) => Number(left.queuedAt || 0) - Number(right.queuedAt || 0))
    .slice(0, limit - indexed.length);
  return [...indexed, ...fallback].sort((left, right) => Number(left.queuedAt || 0) - Number(right.queuedAt || 0));
}

async function deletePending(ids) {
  await deleteIndexed(ids);
  const idSet = new Set(ids);
  const fallback = fallbackOutbox().filter((event) => !idSet.has(event?.eventId));
  writeJsonNative(FALLBACK_OUTBOX_KEY, fallback);
}

function batchWithinBudget(events) {
  const batch = [];
  let bytes = 32;
  for (const event of events) {
    const size = JSON.stringify(event).length + 1;
    if (batch.length && (batch.length >= MAX_BATCH_EVENTS || bytes + size > MAX_BATCH_BYTES)) break;
    if (!batch.length && size > MAX_BATCH_BYTES) {
      batch.push(event);
      break;
    }
    batch.push(event);
    bytes += size;
  }
  return batch;
}

async function postEvents(events, { keepalive = false } = {}) {
  if (!identity || !events.length) return null;
  health.uploadAttempts += 1;
  persistHealth();
  const response = await gameFrameOptionalFetch("/api/me/cascade/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events: events.map(({ queuedAt: _queuedAt, ...event }) => event) }),
    keepalive,
  }, identity);
  if (response.status === 401) identity = null;
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    health.uploadFailures += 1;
    persistHealth();
    return null;
  }
  return value;
}

async function flushOutbox({ keepalive = false, rounds = 8 } = {}) {
  if (!identity || flushPending || navigator.onLine === false) return;
  flushPending = true;
  try {
    for (let round = 0; round < rounds; round += 1) {
      const candidates = await pendingEvents(MAX_BATCH_EVENTS);
      const batch = batchWithinBudget(candidates);
      if (!batch.length) return;
      const result = await postEvents(batch, { keepalive });
      if (!result) return;

      const acceptedIds = Array.isArray(result.acceptedEventIds) ? result.acceptedEventIds : [];
      const duplicateIds = Array.isArray(result.duplicateEventIds) ? result.duplicateEventIds : [];
      const rejected = Array.isArray(result.rejected) ? result.rejected : [];
      let resolvedIds = [...acceptedIds, ...duplicateIds, ...rejected.map((value) => value?.eventId).filter(Boolean)];

      // Backward-compatible deploy overlap: the v1 endpoint only returned counts.
      if (!resolvedIds.length && Number(result.accepted || 0) + Number(result.duplicates || 0) === batch.length) {
        resolvedIds = batch.map((event) => event.eventId);
      }
      if (!resolvedIds.length) return;

      health.accepted += acceptedIds.length || Number(result.accepted || 0);
      health.duplicates += duplicateIds.length || Number(result.duplicates || 0);
      health.rejected += rejected.length;
      persistHealth();
      await deletePending([...new Set(resolvedIds)]);
      if (batch.length < MAX_BATCH_EVENTS) return;
    }
  } catch {
    health.uploadFailures += 1;
    persistHealth();
  } finally {
    flushPending = false;
  }
}

function syntheticWireEvent(type, payload = {}, attemptId = null) {
  return wireEvent({
    eventId: uuid("cascade-event"),
    at: new Date().toISOString(),
    type,
    mode: "telemetry",
    sessionId: session.sessionId,
    attemptId,
    telemetrySchemaVersion: TELEMETRY_SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    activeMs: Math.round(session.activeMs),
    ...payload,
  });
}

function queueSynthetic(type, payload = {}, attemptId = null) {
  void enqueueWire(syntheticWireEvent(type, payload, attemptId));
}

function healthSnapshot() {
  return {
    generated: health.generated,
    accepted: health.accepted,
    duplicates: health.duplicates,
    rejected: health.rejected,
    uploadAttempts: health.uploadAttempts,
    uploadFailures: health.uploadFailures,
    outboxWriteFailures: health.outboxWriteFailures,
    fallbackDrops: health.fallbackDrops,
    payloadTruncated: health.payloadTruncated,
  };
}

function legacyCanonicalize(events) {
  const duplicateCounts = new Map();
  let historicalSessionId = null;
  let previousAt = null;
  let activeAttemptId = null;
  let activeAttemptMode = null;
  return events.map((raw) => {
    const event = { ...raw };
    const fingerprint = JSON.stringify(raw);
    const occurrence = duplicateCounts.get(fingerprint) || 0;
    duplicateCounts.set(fingerprint, occurrence + 1);
    if (!event.eventId) event.eventId = `cascade-raw:${fnv1a(fingerprint)}:${occurrence}`;
    const timestamp = eventTimestamp(event);
    if (!event.sessionId) {
      if (timestamp !== null && timestamp < session.startedAt - 1_000) {
        if (previousAt === null || timestamp - previousAt >= NEW_BLOCK_AFTER_MS || !historicalSessionId) {
          historicalSessionId = `cascade-history:${new Date(timestamp).toISOString()}`;
        }
        event.sessionId = historicalSessionId;
        previousAt = timestamp;
      } else {
        event.sessionId = session.sessionId;
      }
    }
    const eventMode = typeof event.mode === "string" ? event.mode : "normal";
    if (event.type === "level_start") {
      activeAttemptId = `cascade-attempt:${event.eventId}`;
      activeAttemptMode = eventMode;
    } else if (event.type === "level_resume" && !activeAttemptId) {
      activeAttemptId = `cascade-attempt:${event.eventId}`;
      activeAttemptMode = eventMode;
    } else if (event.type === "blitz_start") {
      activeAttemptId = `cascade-blitz:${event.eventId}`;
      activeAttemptMode = "blitz";
    }
    if (!event.attemptId && activeAttemptId && activeAttemptMode === eventMode) event.attemptId = activeAttemptId;
    if (event.type === "level_win" || event.type === "level_failed" || event.type === "blitz_complete") {
      activeAttemptId = null;
      activeAttemptMode = null;
    }
    return event;
  });
}

async function migrateLegacyHistory() {
  if (migrationPending || storage.getItem(MIGRATION_KEY) === "1") return;
  migrationPending = true;
  try {
    const value = readJson(ANALYTICS_KEY, []);
    const events = Array.isArray(value) ? legacyCanonicalize(value.filter((event) => event && typeof event === "object")) : [];
    if (events.length) nativeSetItem.call(storage, ANALYTICS_KEY, JSON.stringify(events.slice(-500)));
    const cursor = storage.getItem(LEGACY_CURSOR_KEY);
    const cursorIndex = cursor ? events.findIndex((event) => event.eventId === cursor) : -1;
    const pending = events.slice(cursorIndex + 1);
    for (const event of pending) await enqueueWire(wireEvent(event), false);
    nativeSetItem.call(storage, MIGRATION_KEY, "1");
    storage.removeItem(LEGACY_CURSOR_KEY);
  } catch {
    // Retry on the next page visit.
  } finally {
    migrationPending = false;
  }
}

function captureRunForEvent(event) {
  const type = String(event.type || "");
  const eventMode = typeof event.mode === "string" ? event.mode : "normal";
  if (type === "blitz_offer") {
    runState.blitz = makeRun("blitz", { phase: "offered", offer: { ...event } });
    runState.lastBlitzOffer = { ...event };
    persistRunState();
    return runState.blitz;
  }
  if (type === "blitz_start") {
    if (!runState.blitz?.attemptId || runState.blitz.phase !== "offered") runState.blitz = makeRun("blitz");
    runState.blitz.phase = "active";
    runState.blitz.startedEventSeen = true;
    persistRunState();
    return runState.blitz;
  }
  if (type === "quick_recall_offer") {
    runState.recall = makeRun("recall", { phase: "offered", level: event.afterLevel });
    persistRunState();
    return runState.recall;
  }
  if (type === "quick_recall_start") {
    if (!runState.recall?.attemptId) runState.recall = makeRun("recall", { level: event.afterLevel });
    runState.recall.phase = "active";
    runState.recall.startedEventSeen = true;
    persistRunState();
    return runState.recall;
  }
  if (eventMode === "blitz") return runState.blitz;
  if (eventMode === "bonus" || type.startsWith("quick_recall_")) return runState.recall;
  if (type === "level_start") {
    const level = Number(event.level) || null;
    const current = ensureNormalRun(level, Boolean(runState.normal?.startedEventSeen));
    current.startedEventSeen = true;
    const snapshot = initialRunSnapshot();
    current.initialBoard ||= snapshot.initialBoard || null;
    current.initialSpecials ||= snapshot.initialSpecials || null;
    current.initialRngState ||= snapshot.initialRngState || null;
    persistRunState();
    return current;
  }
  if (type === "level_resume") {
    const current = ensureNormalRun(Number(event.level) || null, false);
    current.startedEventSeen = true;
    persistRunState();
    return current;
  }
  return activeRunForMode(eventMode);
}

function canonicalizeLiveEvent(raw) {
  const event = { ...raw };
  event.eventId ||= uuid("cascade-event");
  event.sessionId ||= session.sessionId;
  event.telemetrySchemaVersion = TELEMETRY_SCHEMA_VERSION;
  event.rulesVersion ||= RULES_VERSION;
  const run = captureRunForEvent(event);
  if (run?.attemptId) {
    event.attemptId ||= run.attemptId;
    event.activeAttemptMs = Math.round(run.activeMs || 0);
  }

  if ((event.type === "move" || event.type === "invalid_swap") && pendingSwapContext && Date.now() - pendingSwapContext.at < 4_000) {
    event.from ??= pendingSwapContext.from;
    event.to ??= pendingSwapContext.to;
    event.inputMethod ??= pendingSwapContext.inputMethod;
    if (event.type === "invalid_swap") event.invalidReason ??= "no_match_after_swap";
    pendingSwapContext = null;
  }

  if (event.type === "level_start" && run) {
    event.initialBoard ??= run.initialBoard;
    event.initialSpecials ??= run.initialSpecials;
    event.initialRngState ??= run.initialRngState;
  }

  const terminal = new Set([
    "level_win", "level_failed", "blitz_complete", "blitz_skip", "blitz_abandon",
    "quick_recall_complete", "quick_recall_skip", "quick_recall_abandon",
  ]);
  if (terminal.has(event.type)) {
    if (event.type.startsWith("blitz_")) setActiveRunForMode("blitz", null);
    else if (event.type.startsWith("quick_recall_")) setActiveRunForMode("bonus", null);
    else setActiveRunForMode("normal", null);
  }
  return event;
}

function appendResearchEvent(type, detail = {}) {
  try {
    const value = readJson(ANALYTICS_KEY, []);
    const events = Array.isArray(value) ? value : [];
    events.push({ at: new Date().toISOString(), type, ...detail });
    storage.setItem(ANALYTICS_KEY, JSON.stringify(events.slice(-500)));
  } catch {
    // Failure-isolated from gameplay.
  }
}

function resourceReason(resource, delta) {
  const active = Boolean(runState.normal?.attemptId || runState.blitz?.attemptId || runState.recall?.attemptId);
  if (!active) return "sync_or_restore";
  if (resource === "hammer") return delta < 0 ? "booster_use" : "star_or_bonus_reward";
  if (resource === "life") return delta < 0 ? "level_failure" : "regeneration_or_refill";
  return "state_transition";
}

function recordResourceChanges(previous, next) {
  for (const [field, resource] of [["hammers", "hammer"], ["lives", "life"]]) {
    const before = Number(previous?.[field]);
    const after = Number(next?.[field]);
    if (!Number.isFinite(before) || !Number.isFinite(after) || before === after) continue;
    const delta = after - before;
    appendResearchEvent("resource_change", {
      mode: runState.blitz?.phase === "active" ? "blitz" : "normal",
      resource,
      direction: delta > 0 ? "source" : "sink",
      amount: Math.abs(delta),
      balanceBefore: before,
      balanceAfter: after,
      reason: resourceReason(resource, delta),
    });
  }
}

function enrichActiveRunWrite(value) {
  try {
    const saved = JSON.parse(String(value));
    if (!saved || typeof saved !== "object" || !Array.isArray(saved.board)) return value;
    let run = runState.normal;
    if (!run?.attemptId || Number(run.level) !== Number(saved.level)) {
      run = makeRun("attempt", {
        level: saved.level,
        initialBoard: saved.board,
        initialSpecials: saved.specials,
        initialRngState: saved.rngState,
      });
      runState.normal = run;
      persistRunState();
    }
    run.initialBoard ||= saved.board.slice();
    run.initialSpecials ||= Array.isArray(saved.specials) ? saved.specials.slice() : null;
    run.initialRngState ||= Number(saved.rngState) || null;
    saved.telemetryAttemptId = run.attemptId;
    saved.telemetryStartedAt = run.startedAt;
    saved.telemetryActiveMs = Math.round(run.activeMs || 0);
    persistRunState();
    return JSON.stringify(saved);
  } catch {
    return value;
  }
}

function installStorageCapture() {
  if (Storage.prototype.setItem.__cascadeTelemetryV2) return;
  const wrapped = function setItem(key, value) {
    if (this !== storage) return nativeSetItem.call(this, key, value);

    if (key === ACTIVE_RUN_KEY) {
      return nativeSetItem.call(this, key, enrichActiveRunWrite(value));
    }

    if (key === CASCADE_STATE_KEY) {
      const previous = readJson(CASCADE_STATE_KEY, null);
      const result = nativeSetItem.call(this, key, value);
      let next = null;
      try { next = JSON.parse(String(value)); } catch { next = null; }
      if (previous && next) queueMicrotask(() => recordResourceChanges(previous, next));
      return result;
    }

    if (key !== ANALYTICS_KEY) return nativeSetItem.call(this, key, value);

    let previous = [];
    let incoming = [];
    try {
      previous = JSON.parse(storage.getItem(ANALYTICS_KEY) || "[]");
      incoming = JSON.parse(String(value));
    } catch {
      return nativeSetItem.call(this, key, value);
    }
    if (!Array.isArray(incoming)) return nativeSetItem.call(this, key, value);
    const previousIds = new Set((Array.isArray(previous) ? previous : []).map((event) => event?.eventId).filter(Boolean));
    const canonical = incoming.map((raw) => raw?.eventId ? raw : canonicalizeLiveEvent(raw));
    const result = nativeSetItem.call(this, key, JSON.stringify(canonical.slice(-500)));
    for (const event of canonical) {
      if (!event?.eventId || previousIds.has(event.eventId)) continue;
      void enqueueWire(wireEvent(event));
    }
    return result;
  };
  Object.defineProperty(wrapped, "__cascadeTelemetryV2", { value: true });
  Storage.prototype.setItem = wrapped;
}

function adjacentIndex(from, dx, dy) {
  const row = Math.floor(from / 8);
  const column = from % 8;
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0 && column < 7) return from + 1;
    if (dx < 0 && column > 0) return from - 1;
    return null;
  }
  if (dy > 0 && row < 7) return from + 8;
  if (dy < 0 && row > 0) return from - 8;
  return null;
}

function tileIndex(target) {
  const tile = target instanceof Element ? target.closest("#board .cascade-tile[data-index]") : null;
  const value = Number(tile?.dataset.index);
  return Number.isInteger(value) && value >= 0 && value < 64 ? value : null;
}

function installInputContextCapture() {
  document.addEventListener("pointerdown", (event) => {
    const from = tileIndex(event.target);
    if (from === null) return;
    lastPointer = {
      pointerId: event.pointerId,
      pointerType: event.pointerType || "pointer",
      from,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      at: Date.now(),
    };
  }, true);
  document.addEventListener("pointermove", (event) => {
    if (!lastPointer || lastPointer.pointerId !== event.pointerId) return;
    lastPointer.x = event.clientX;
    lastPointer.y = event.clientY;
  }, true);
  document.addEventListener("pointerup", (event) => {
    if (!lastPointer || lastPointer.pointerId !== event.pointerId) return;
    const dx = event.clientX - lastPointer.startX;
    const dy = event.clientY - lastPointer.startY;
    if (Math.hypot(dx, dy) >= 10) {
      const to = adjacentIndex(lastPointer.from, dx, dy);
      if (to !== null) {
        pendingSwapContext = {
          from: lastPointer.from,
          to,
          inputMethod: `${lastPointer.pointerType}-drag`,
          at: Date.now(),
        };
      }
    }
  }, true);
  document.addEventListener("click", (event) => {
    const index = tileIndex(event.target);
    if (index === null || pendingSwapContext) return;
    const pointerType = lastPointer && Date.now() - lastPointer.at < 2_000
      ? lastPointer.pointerType
      : (event.detail === 0 ? "keyboard-or-assistive" : "click");
    if (clickSelection === null) {
      clickSelection = index;
      return;
    }
    if (clickSelection === index) {
      clickSelection = null;
      return;
    }
    pendingSwapContext = {
      from: clickSelection,
      to: index,
      inputMethod: `${pointerType}-click-pair`,
      at: Date.now(),
    };
    clickSelection = null;
  }, true);
}

function finishRecallRound(progressText) {
  if (!recallRound || recallRound.emitted) return;
  const perfect = progressText === "PERFECT";
  const match = /^(\d+)\/(\d+) CORRECT$/.exec(progressText);
  if (!perfect && !match) return;
  const total = perfect ? recallRound.responses.length : Number(match[2]);
  const correct = perfect ? total : Number(match[1]);
  recallRound.emitted = true;
  appendResearchEvent("quick_recall_round_complete", {
    mode: "bonus",
    round: recallRound.round,
    sequenceLength: recallRound.sequence.length || total,
    sequence: recallRound.sequence.slice(),
    response: recallRound.responses.slice(),
    correct,
    total,
    perfect,
    firstInputMs: recallRound.firstInputAt && recallRound.repeatStartedAt
      ? recallRound.firstInputAt - recallRound.repeatStartedAt
      : null,
    responseMs: recallRound.repeatStartedAt ? Date.now() - recallRound.repeatStartedAt : null,
  });
}

function inspectRecallDialog(dialog) {
  const title = dialog.querySelector("[data-recall-title]")?.textContent || "";
  const progress = dialog.querySelector("[data-recall-progress]")?.textContent || "";
  const roundMatch = /^Round (\d+) of /.exec(title);
  if (roundMatch) {
    const round = Number(roundMatch[1]);
    if (!recallRound || recallRound.round !== round) {
      recallRound = {
        round,
        sequence: [],
        responses: [],
        repeatStartedAt: null,
        firstInputAt: null,
        emitted: false,
        stageOccupied: false,
      };
    }
    const stageTile = dialog.querySelector("[data-recall-stage] .cascade-recall-tile[data-kind]");
    if (progress === "WATCH") {
      if (stageTile && !recallRound.stageOccupied) {
        recallRound.sequence.push(Number(stageTile.dataset.kind));
        recallRound.stageOccupied = true;
      } else if (!stageTile) {
        recallRound.stageOccupied = false;
      }
    }
    if (progress.startsWith("REPEAT") && !recallRound.repeatStartedAt) recallRound.repeatStartedAt = Date.now();
    finishRecallRound(progress);
  }
}

function attachRecallObserver(dialog) {
  if (recallDialogObserver) return;
  recallDialogObserver = new MutationObserver(() => inspectRecallDialog(dialog));
  recallDialogObserver.observe(dialog, { childList: true, subtree: true, characterData: true, attributes: true });
  inspectRecallDialog(dialog);
}

function installBonusCapture() {
  const existing = document.querySelector("#cascade-recall-dialog");
  if (existing) attachRecallObserver(existing);
  else {
    const finder = new MutationObserver(() => {
      const dialog = document.querySelector("#cascade-recall-dialog");
      if (!dialog) return;
      finder.disconnect();
      attachRecallObserver(dialog);
    });
    finder.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("click", (event) => {
    const recallChoice = event.target instanceof Element
      ? event.target.closest("#cascade-recall-dialog [data-recall-choices] button[data-kind]")
      : null;
    if (recallChoice && recallRound) {
      if (!recallRound.firstInputAt) recallRound.firstInputAt = Date.now();
      recallRound.responses.push(Number(recallChoice.dataset.kind));
    }

    const button = event.target instanceof Element ? event.target.closest("#result-dialog button") : null;
    if (!button || button.textContent?.trim() !== "Skip" || !runState.blitz?.attemptId) return;
    const title = document.querySelector("#result-title")?.textContent || "";
    const kicker = document.querySelector("#result-kicker")?.textContent || "";
    if (title !== "BLITZ!" && kicker !== "BONUS ROUND") return;
    appendResearchEvent("blitz_skip", {
      mode: "blitz",
      phase: runState.blitz.phase,
      id: runState.lastBlitzOffer?.id || null,
      afterLevel: runState.lastBlitzOffer?.afterLevel || runState.lastBlitzOffer?.level || null,
    });
  }, true);
}

function noteInteraction() {
  const now = Date.now();
  if (now - session.lastInteractionAt >= NEW_BLOCK_AFTER_MS) {
    queueSynthetic("telemetry_session_end", { reason: "inactivity", ...healthSnapshot() });
    session = newSession(now);
    lastInputAt = now;
    lastTickAt = now;
    persistSession(true);
    queueSynthetic("telemetry_session_start", { reason: "return_after_inactivity", path: window.location.pathname, ...clientContext() });
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
    for (const key of ["normal", "blitz", "recall"]) {
      if (runState[key]?.attemptId) runState[key].activeMs = Math.max(0, Number(runState[key].activeMs) || 0) + elapsed;
    }
  }
  session.lastSeenAt = now;
  lastTickAt = now;
  persistSession();
  persistRunState();
}

function checkpointAbandonedBonusModes() {
  if (runState.blitz?.attemptId) {
    appendResearchEvent("blitz_abandon", {
      mode: "blitz",
      phase: runState.blitz.phase,
      id: runState.lastBlitzOffer?.id || null,
    });
  }
  if (runState.recall?.attemptId) {
    appendResearchEvent("quick_recall_abandon", {
      mode: "bonus",
      phase: runState.recall.phase,
      afterLevel: runState.recall.level,
    });
  }
}

installStorageCapture();
installInputContextCapture();
installBonusCapture();

async function start() {
  await migrateLegacyHistory();
  identity = await tryGameFrameIdentity({ preferredDevelopmentPlayerId: query.get("player") });
  if (!identity) return;

  persistSession(true);
  queueSynthetic("telemetry_session_start", {
    reason: "page_open",
    path: window.location.pathname,
    ...clientContext(),
    ...healthSnapshot(),
  });
  await flushOutbox();

  for (const eventName of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(eventName, noteInteraction, { passive: true });
  }

  window.setInterval(tickActiveTime, ACTIVE_TICK_MS);
  window.setInterval(() => void flushOutbox(), FLUSH_INTERVAL_MS);
  window.setInterval(() => {
    if (document.hidden || Date.now() - lastInputAt > IDLE_AFTER_MS) return;
    queueSynthetic("telemetry_session_heartbeat", { visible: true, idle: false, ...healthSnapshot() });
    void flushOutbox();
  }, HEARTBEAT_INTERVAL_MS);

  window.addEventListener("online", () => void flushOutbox());
  document.addEventListener("visibilitychange", () => {
    lastTickAt = Date.now();
    if (document.hidden) {
      persistSession(true);
      queueSynthetic("telemetry_session_heartbeat", { visible: false, ...healthSnapshot() });
      void flushOutbox({ keepalive: true, rounds: 1 });
    } else {
      noteInteraction();
      void migrateLegacyHistory();
      void flushOutbox();
    }
  });

  window.addEventListener("pagehide", () => {
    tickActiveTime();
    checkpointAbandonedBonusModes();
    persistSession(true);
    queueSynthetic("telemetry_session_end", { reason: "pagehide", ...healthSnapshot() });
    void flushOutbox({ keepalive: true, rounds: 1 });
  });
}

void start();
