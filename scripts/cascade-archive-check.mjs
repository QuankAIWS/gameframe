import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve("data/cascade/difficulty-archive");
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const allowedStatuses = new Set(["historical", "accepted", "candidate"]);
const prohibitedRawKeys = new Set([
  "displayName",
  "sessionId",
  "attemptId",
  "eventId",
  "incidentId",
  "userAgent",
  "discordUserId",
]);

if (manifest.archiveSchemaVersion !== 1) throw new Error("Cascade archive manifest schema must be version 1");
if (manifest.publicRepository !== true || manifest.rawPlayerTelemetryAllowed !== false) {
  throw new Error("Cascade archive must explicitly prohibit raw player telemetry in the public repository");
}

const paths = new Set();
for (const entry of manifest.entries || []) {
  if (!entry?.path || paths.has(entry.path)) throw new Error(`Duplicate or missing archive path: ${entry?.path}`);
  paths.add(entry.path);
  if (!allowedStatuses.has(entry.status)) throw new Error(`Invalid archive status for ${entry.path}: ${entry.status}`);

  const content = JSON.parse(await readFile(resolve(root, entry.path), "utf8"));
  if (content.archiveSchemaVersion !== 1) throw new Error(`${entry.path}: unsupported archive schema`);
  if (content.status !== entry.status) throw new Error(`${entry.path}: status differs from manifest`);
  if (content.label !== entry.label) throw new Error(`${entry.path}: label differs from manifest`);

  const scan = (value, trail = []) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => scan(item, [...trail, index]));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (prohibitedRawKeys.has(key)) {
        throw new Error(`${entry.path}: prohibited raw-telemetry key "${key}" at ${[...trail, key].join(".")}`);
      }
      scan(child, [...trail, key]);
    }
  };
  scan(content);

  if (content.archiveType?.includes("bot") || content.archiveType?.includes("fragility")) {
    if (!content.provenance?.headSha || !content.provenance?.workflowRunId || !content.provenance?.workflowJobId) {
      throw new Error(`${entry.path}: bot evidence requires exact head SHA and workflow run/job provenance`);
    }
  }
}

const onDisk = (await readdir(root, { recursive: true }))
  .map((path) => String(path).replaceAll("\\", "/"))
  .filter((path) => path.endsWith(".json") && path !== "manifest.json");
for (const path of onDisk) {
  if (!paths.has(path)) throw new Error(`Unmanifested Cascade archive JSON: ${path}`);
}
for (const path of paths) {
  if (!onDisk.includes(path)) throw new Error(`Manifest references missing Cascade archive JSON: ${path}`);
}

console.log(`Cascade difficulty archive OK: ${paths.size} manifest entries`);
