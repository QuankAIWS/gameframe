import { readFile, writeFile } from "node:fs/promises";

const sourceUrl = new URL("../src/games/spider-solitaire/engine.js", import.meta.url);
const browserUrl = new URL("../public/spider-solitaire-engine.js", import.meta.url);
const check = process.argv.includes("--check");
const source = await readFile(sourceUrl, "utf8");

if (check) {
  const browser = await readFile(browserUrl, "utf8");
  if (browser !== source) {
    console.error("Spider Solitaire browser engine is out of sync. Run npm run build:spider-solitaire.");
    process.exit(1);
  }
  console.log("Spider Solitaire browser engine is in sync.");
} else {
  await writeFile(browserUrl, source, "utf8");
  console.log("Built public/spider-solitaire-engine.js from the canonical game engine.");
}
