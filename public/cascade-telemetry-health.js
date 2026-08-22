const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const REPORT_INTERVAL_MS = 5 * 60 * 1000;
const MAX_TEXT = 240;

const technical = {
  longTasks: 0,
  longTaskTotalMs: 0,
  longestTaskMs: 0,
  errors: 0,
  rejections: 0,
};

function bounded(value, maximum = MAX_TEXT) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maximum) : null;
}

function safePath(value) {
  try {
    const url = new URL(String(value || ""), window.location.href);
    return url.origin === window.location.origin ? url.pathname : url.hostname;
  } catch {
    return null;
  }
}

function append(type, detail = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "[]");
    const events = Array.isArray(value) ? value : [];
    events.push({
      at: new Date().toISOString(),
      type,
      mode: "technical",
      ...detail,
    });
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events.slice(-500)));
  } catch {
    // Technical observability must never interfere with play.
  }
}

function navigationMetrics() {
  const entry = performance.getEntriesByType?.("navigation")?.[0];
  if (!entry) return {};
  return {
    ttfbMs: Math.max(0, Math.round(entry.responseStart || 0)),
    domInteractiveMs: Math.max(0, Math.round(entry.domInteractive || 0)),
    domContentLoadedMs: Math.max(0, Math.round(entry.domContentLoadedEventEnd || 0)),
    loadMs: Math.max(0, Math.round(entry.loadEventEnd || entry.duration || 0)),
    transferBytes: Math.max(0, Number(entry.transferSize) || 0),
    encodedBodyBytes: Math.max(0, Number(entry.encodedBodySize) || 0),
    decodedBodyBytes: Math.max(0, Number(entry.decodedBodySize) || 0),
  };
}

function memoryMetrics() {
  const memory = performance.memory;
  if (!memory) return {};
  return {
    usedJsHeapBytes: Math.max(0, Number(memory.usedJSHeapSize) || 0),
    totalJsHeapBytes: Math.max(0, Number(memory.totalJSHeapSize) || 0),
  };
}

function connectionMetrics() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return {};
  return {
    effectiveConnectionType: bounded(connection.effectiveType, 24),
    saveData: Boolean(connection.saveData),
    downlinkMbps: Number.isFinite(Number(connection.downlink)) ? Number(connection.downlink) : null,
    rttMs: Number.isFinite(Number(connection.rtt)) ? Number(connection.rtt) : null,
  };
}

function report(reason) {
  append("technical_health", {
    reason,
    longTasks: technical.longTasks,
    longTaskTotalMs: Math.round(technical.longTaskTotalMs),
    longestTaskMs: Math.round(technical.longestTaskMs),
    errors: technical.errors,
    unhandledRejections: technical.rejections,
    ...memoryMetrics(),
  });
}

window.addEventListener("error", (event) => {
  technical.errors += 1;
  append("client_error", {
    errorName: bounded(event.error?.name, 80),
    message: bounded(event.message || event.error?.message),
    source: safePath(event.filename),
    line: Number.isFinite(Number(event.lineno)) ? Number(event.lineno) : null,
    column: Number.isFinite(Number(event.colno)) ? Number(event.colno) : null,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  technical.rejections += 1;
  const reason = event.reason;
  append("client_error", {
    errorName: bounded(reason?.name, 80) || "UnhandledRejection",
    message: bounded(reason?.message || reason),
    source: "promise",
  });
});

try {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const duration = Math.max(0, Number(entry.duration) || 0);
      technical.longTasks += 1;
      technical.longTaskTotalMs += duration;
      technical.longestTaskMs = Math.max(technical.longestTaskMs, duration);
    }
  });
  observer.observe({ type: "longtask", buffered: true });
} catch {
  // Long Task API is not available in every browser.
}

window.addEventListener("load", () => {
  queueMicrotask(() => append("technical_context", {
    ...navigationMetrics(),
    ...connectionMetrics(),
  }));
}, { once: true });

window.setInterval(() => {
  if (document.hidden) return;
  report("periodic");
}, REPORT_INTERVAL_MS);

window.addEventListener("pagehide", () => report("pagehide"));
