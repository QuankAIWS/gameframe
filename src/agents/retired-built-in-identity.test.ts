import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const retired = ["th", "eo"].join("");
const retiredIdentifierPattern = new RegExp(
  `${retired}\\b|\\b${retired}(?=[A-Z0-9_])`,
  "i",
);
const textExtensions = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".jsonc", ".html", ".css",
  ".md", ".txt", ".yml", ".yaml",
]);
const executableRoots = ["src", "public", "test", "scripts", ".github"];

async function collectFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolutePath));
    else if (entry.isFile()) files.push(absolutePath);
  }
  return files;
}

test("executable GameFrame surfaces contain no retired built-in opponent identifier", async () => {
  const violations: string[] = [];
  for (const root of executableRoots) {
    for (const absolutePath of await collectFiles(join(repositoryRoot, root))) {
      if (!textExtensions.has(extname(absolutePath).toLowerCase())) continue;
      const repositoryPath = relative(repositoryRoot, absolutePath).replaceAll("\\", "/");
      const content = await readFile(absolutePath, "utf8");
      if (retiredIdentifierPattern.test(repositoryPath)) violations.push(`${repositoryPath} (path)`);
      if (retiredIdentifierPattern.test(content)) violations.push(`${repositoryPath} (content)`);
    }
  }
  assert.deepEqual(
    violations,
    [],
    `Executable GameFrame surfaces retain the retired built-in opponent identifier:\n${violations.join("\n")}`,
  );
});
