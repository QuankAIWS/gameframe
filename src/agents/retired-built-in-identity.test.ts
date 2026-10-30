import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const retired = ["th", "eo"].join("");
// Encode the retired spelling with explicit upper/lower letter classes.
// Using /i would also make [A-Z] match lowercase prose such as "theoretical".
const retiredCasePattern = [...retired]
  .map((letter) => `[${letter}${letter.toUpperCase()}]`)
  .join("");
const retiredIdentifierPattern = new RegExp(
  `${retiredCasePattern}(?:\\b|(?=[A-Z0-9_]))`,
);
const textExtensions = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".jsonc", ".html", ".css",
  ".md", ".txt", ".yml", ".yaml",
]);
const executableRoots = ["src", "public", "test", "scripts", ".github"];

test("retired identifier guard detects every case and embedded name without prose false positives", () => {
  const pascal = `${retired[0].toUpperCase()}${retired.slice(1)}`;
  const rejected = [
    retired, retired.toUpperCase(), pascal,
    `opponent${pascal}`, `opponent${retired.toUpperCase()}`, `opponent${retired}`,
    `${retired}Id`, `${retired.toUpperCase()}_ID`,
  ];
  for (const candidate of rejected) {
    assert.equal(retiredIdentifierPattern.test(candidate), true, `Expected rejection: ${candidate}`);
  }
  const prose = ["theoretical", "theorem", "theology", "polytheological", "opponentTheoretical"];
  for (const candidate of prose) {
    assert.equal(retiredIdentifierPattern.test(candidate), false, `Unexpected prose rejection: ${candidate}`);
  }
});
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
