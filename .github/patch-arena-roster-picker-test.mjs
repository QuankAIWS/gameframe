import { readFile, writeFile } from "node:fs/promises";
const path = "test/browser/monster-master-roster.spec.mjs";
const text = await readFile(path, "utf8");
const from = '    "gloamspore-stalker-v1",\n    "voidshard-reaver-v1",';
const to = '    "stormcrest-skitter-v1",\n    "voidshard-reaver-v1",';
if (!text.includes(from)) throw new Error("Roster picker expectation anchor missing");
await writeFile(path, text.replace(from, to));
