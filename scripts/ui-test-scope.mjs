import { appendFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

const browserInfrastructure = new Set([
  "playwright.config.mjs",
  "playwright.visual.config.mjs",
]);

const exactShellFiles = new Set([
  "public/app.js",
  "public/auth-launcher.js",
  "public/game-hub.js",
  "public/gameframe-nav.js",
  "public/styles.css",
  "test/browser/game-hub-navigation.spec.mjs",
  "test/visual/player-ui-review.spec.mjs",
  "test/visual/player-ui-regressions.spec.mjs",
]);

const exactCasualFiles = new Set([
  "public/casual-games.html",
  "public/casual-games.css",
  "public/casual-games.js",
  "test/browser/casual-games.spec.mjs",
  "test/visual/casual-games-destination.spec.mjs",
]);

const exactPlayerFiles = new Set([
  "public/home-dashboard.js",
  "public/profile.html",
  "public/profile-app.js",
  "public/leaderboard.html",
  "public/leaderboard-app.js",
  "public/matches.html",
  "public/matches-app.js",
  "public/player-platform.css",
  "public/player-social.css",
  "public/cascade-progression-sync.js",
  "src/browser/player-navigation-contract.test.ts",
  "src/browser/player-platform-extension-contract.test.ts",
  "src/cloudflare/player-progression.ts",
  "src/cloudflare/player-platform-object-runtime.ts",
  "src/cloudflare/player-platform-object-runtime.test.ts",
  "src/cloudflare/player-platform-coordinator.ts",
  "src/server/in-memory-player-platform.ts",
  "test/browser/player-platform.spec.mjs",
  "test/workerd/player-progression.test.ts",
  "test/visual/player-platform.spec.mjs",
]);

function normalize(path) {
  return String(path || "").trim().replaceAll("\\", "/");
}

function isCascadeTelemetryFile(file) {
  return file === "public/cascade-admin-telemetry.js"
    || file === "public/cascade-telemetry-sync.js"
    || /^src\/cloudflare\/cascade-telemetry-.*\.ts$/.test(file)
    || /^test\/browser\/cascade-telemetry.*\.spec\.mjs$/.test(file);
}

function isCascadeUiFile(file) {
  const publicCascade = /^public\/cascade[^/]*\.(?:html|css|js)$/.test(file)
    && file !== "public/cascade-progression-sync.js"
    && file !== "public/cascade-admin-telemetry.js"
    && file !== "public/cascade-telemetry-sync.js";
  return publicCascade
    || file.startsWith("src/games/cascade/")
    || /^test\/browser\/cascade.*\.spec\.mjs$/.test(file)
    || /^test\/visual\/cascade.*\.spec\.mjs$/.test(file);
}

function isCascadeProfileFile(file) {
  return file === "scripts/cascade-profile.mjs"
    || file.startsWith("src/games/cascade/");
}

function isRpgFile(file) {
  return /^public\/monster-master-rpg[^/]*\.(?:html|css|js)$/.test(file)
    || /^test\/browser\/monster-master-rpg.*\.spec\.mjs$/.test(file)
    || file.startsWith("test/rpg-integration/")
    || /^playwright\.rpg.*\.config\.mjs$/.test(file)
    || /^src\/cloudflare\/rpg-.*\.ts$/.test(file);
}

function isMonsterMasterFile(file) {
  if (isRpgFile(file)) return false;
  return /^public\/monster-master[^/]*\.(?:html|css|js)$/.test(file)
    || file.startsWith("public/assets/monster-master/")
    || file === "planning/monster-master-rules.md"
    || file.startsWith("planning/monster-master/assets/")
    || file === "scripts/build-monster-master-pixi.mjs"
    || /^scripts\/monster-master-.*\.mjs$/.test(file)
    || file.startsWith("src/browser/monster-master")
    || file.startsWith("src/games/monster-master/")
    || /^test\/browser\/monster-master.*\.spec\.mjs$/.test(file)
    || file === "test/browser/motion-polish.spec.mjs"
    || /^test\/visual\/monster-master.*\.spec\.mjs$/.test(file);
}

function isCasualFile(file) {
  return exactCasualFiles.has(file)
    || file.startsWith("public/assets/gameframe/cards/cascade-crush-card.");
}

export function classifyUiTestScope(paths) {
  const files = [...new Set(paths.map(normalize).filter(Boolean))];
  const scope = {
    shell: false,
    casual: false,
    cascadeUi: false,
    cascadeProfile: false,
    cascadeTelemetry: false,
    monsterMaster: false,
    playerPlatform: false,
  };

  for (const file of files) {
    if (browserInfrastructure.has(file)) {
      scope.shell = true;
      scope.casual = true;
      scope.cascadeUi = true;
      scope.monsterMaster = true;
      scope.playerPlatform = true;
      continue;
    }

    if (exactShellFiles.has(file)) scope.shell = true;
    if (isCasualFile(file)) scope.casual = true;
    if (isCascadeUiFile(file)) scope.cascadeUi = true;
    if (isCascadeProfileFile(file)) scope.cascadeProfile = true;
    if (isCascadeTelemetryFile(file)) scope.cascadeTelemetry = true;
    if (isMonsterMasterFile(file)) scope.monsterMaster = true;
    if (exactPlayerFiles.has(file)) scope.playerPlatform = true;
  }

  return scope;
}

async function readStdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text.split(/\r?\n/).filter(Boolean);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const outputPathIndex = process.argv.indexOf("--github-output");
  const outputPath = outputPathIndex >= 0 ? process.argv[outputPathIndex + 1] : null;
  const scope = args.has("--all")
    ? {
        shell: true,
        casual: true,
        cascadeUi: true,
        cascadeProfile: true,
        cascadeTelemetry: true,
        monsterMaster: true,
        playerPlatform: true,
      }
    : classifyUiTestScope(await readStdin());

  const lines = Object.entries(scope).map(([key, value]) => `${key}=${value}`);
  if (outputPath) await appendFile(outputPath, `${lines.join("\n")}\n`);
  else process.stdout.write(`${JSON.stringify(scope)}\n`);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
