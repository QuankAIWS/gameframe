import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function collectTests(directory) {
  const results = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      results.push(...collectTests(path));
    } else if (entry.endsWith(".test.ts")) {
      results.push(path);
    }
  }
  return results.sort();
}

const tests = collectTests("src");
if (tests.length === 0) {
  console.error("No TypeScript tests were found.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--test", ...tests],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
