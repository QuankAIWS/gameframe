import { gameFrameOptionalFetch, tryGameFrameIdentity } from "./gameframe-auth.js";

const QUEUE_KEY = "scribbles-gameframe.cascade-diagnostics-queue:v1";
const FLUSH_INTERVAL_MS = 2_000;
const MAX_BATCH = 4;
const MAX_REQUEST_CHARS = 15_000;
const MAX_DELIVERY_PAYLOAD_CHARS = 7_800;
const storage = window.localStorage;
const query = new URLSearchParams(window.location.search);
let identity = null;
let identityPending = null;
let flushPending = false;

function readQueue() {
  try {
    const value = JSON.parse(storage.getItem(QUEUE_KEY) || "null");
    return Array.isArray(value) ? value.filter((incident) => incident && typeof incident === "object") : [];
  } catch {
    return [];
  }
}

function writeQueue(value) {
  try {
    if (value.length) storage.setItem(QUEUE_KEY, JSON.stringify(value));
    else storage.removeItem(QUEUE_KEY);
  } catch {
    // Diagnostic delivery must never affect gameplay.
  }
}

function serializedLength(value) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function deliveryIncident(incident) {
  const payloadChars = serializedLength(incident?.payload ?? {});
  if (payloadChars <= MAX_DELIVERY_PAYLOAD_CHARS) return incident;
  return {
    incidentId: incident?.incidentId,
    at: incident?.at,
    type: "diagnostic_payload_truncated",
    payload: {
      deliveryTruncated: true,
      originalType: typeof incident?.type === "string" ? incident.type : null,
      originalPayloadChars: Number.isFinite(payloadChars) ? payloadChars : null,
    },
  };
}

function buildBatch(queue) {
  const originals = [];
  const incidents = [];
  for (const original of queue.slice(0, MAX_BATCH)) {
    const candidate = deliveryIncident(original);
    const next = [...incidents, candidate];
    if (serializedLength({ incidents: next }) > MAX_REQUEST_CHARS) break;
    originals.push(original);
    incidents.push(candidate);
  }
  if (!incidents.length && queue.length) {
    originals.push(queue[0]);
    incidents.push(deliveryIncident(queue[0]));
  }
  return { originals, incidents };
}

function removeQueued(originals) {
  const ids = new Set(originals.map((incident) => incident?.incidentId));
  writeQueue(readQueue().filter((incident) => !ids.has(incident?.incidentId)));
}

function permanentlyRejected(status) {
  return status === 400 || status === 413;
}

async function ensureIdentity() {
  if (identity) return identity;
  if (identityPending) return identityPending;
  identityPending = tryGameFrameIdentity({
    preferredDevelopmentPlayerId: query.get("player"),
  }).then((value) => {
    identity = value;
    return value;
  }).finally(() => {
    identityPending = null;
  });
  return identityPending;
}

async function postIncidents(incidents, { keepalive = false } = {}) {
  if (!identity || !incidents.length) return null;
  const response = await gameFrameOptionalFetch("/api/me/cascade/diagnostics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ incidents }),
    keepalive,
  }, identity);
  if (response.status === 401) identity = null;
  return response;
}

async function isolateRejectedBatch(batch, { keepalive = false } = {}) {
  const handled = [];
  for (let index = 0; index < batch.incidents.length; index += 1) {
    const response = await postIncidents([batch.incidents[index]], { keepalive });
    if (!response) break;
    if (response.ok || permanentlyRejected(response.status)) {
      handled.push(batch.originals[index]);
      continue;
    }
    break;
  }
  if (handled.length) removeQueued(handled);
}

async function flush({ keepalive = false } = {}) {
  if (flushPending) return;
  const queue = readQueue();
  if (!queue.length) return;
  flushPending = true;
  try {
    if (!await ensureIdentity()) return;
    const batch = buildBatch(queue);
    if (!batch.incidents.length) return;
    const response = await postIncidents(batch.incidents, { keepalive });
    if (!response) return;
    if (response.ok) {
      removeQueued(batch.originals);
      return;
    }
    if (!permanentlyRejected(response.status)) return;
    if (batch.incidents.length === 1) {
      removeQueued(batch.originals);
      return;
    }
    await isolateRejectedBatch(batch, { keepalive });
  } catch {
    // Transient failures leave incidents in the bounded local queue for retry.
  } finally {
    flushPending = false;
  }
}

function start() {
  // No session lookup or diagnostics POST occurs on an ordinary clean page boot.
  // Identity is resolved lazily only after an incident actually exists.
  if (readQueue().length) void flush();
  window.setInterval(() => {
    if (readQueue().length) void flush();
  }, FLUSH_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!readQueue().length) return;
    if (document.hidden) void flush({ keepalive: true });
    else void flush();
  });
  window.addEventListener("cascade:diagnostic-queued", () => void flush());
  window.addEventListener("pagehide", () => {
    if (readQueue().length) void flush({ keepalive: true });
  });
}

window.cascadeDiagnosticsSync = Object.freeze({ flush });
start();
