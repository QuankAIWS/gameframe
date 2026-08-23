import { gameFrameOptionalFetch, tryGameFrameIdentity } from "./gameframe-auth.js";

const QUEUE_KEY = "scribbles-gameframe.cascade-diagnostics-queue:v1";
const FLUSH_INTERVAL_MS = 2_000;
const MAX_BATCH = 4;
const storage = window.localStorage;
const query = new URLSearchParams(window.location.search);
let identity = null;
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

async function postIncidents(incidents, { keepalive = false } = {}) {
  if (!identity || !incidents.length) return false;
  const response = await gameFrameOptionalFetch("/api/me/cascade/diagnostics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ incidents }),
    keepalive,
  }, identity);
  if (response.status === 401) identity = null;
  return response.ok;
}

async function flush({ keepalive = false } = {}) {
  if (!identity || flushPending) return;
  const queue = readQueue();
  if (!queue.length) return;
  flushPending = true;
  try {
    const pending = queue.slice(0, MAX_BATCH);
    if (!await postIncidents(pending, { keepalive })) return;
    const delivered = new Set(pending.map((incident) => incident.incidentId));
    writeQueue(readQueue().filter((incident) => !delivered.has(incident.incidentId)));
  } catch {
    // Incidents stay in the bounded local queue for the next attempt/page boot.
  } finally {
    flushPending = false;
  }
}

async function start() {
  identity = await tryGameFrameIdentity({
    preferredDevelopmentPlayerId: query.get("player"),
  });
  if (!identity) return;
  await flush();
  window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) void flush({ keepalive: true });
    else void flush();
  });
  window.addEventListener("cascade:diagnostic-queued", () => void flush());
  window.addEventListener("pagehide", () => void flush({ keepalive: true }));
}

void start();
