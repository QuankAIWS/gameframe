import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

function elementStub() {
  return {
    textContent: "",
    hidden: false,
    dataset: {},
    style: { setProperty() {} },
    lastChild: { textContent: "" },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {},
    append() {},
    appendChild() {},
    insertAdjacentHTML() {},
    addEventListener() {},
    querySelector() { return elementStub(); },
    querySelectorAll() { return []; },
  };
}

async function loadEngine() {
  const source = await read("public/othello-fidelity-app-1.js");
  const canvas = {
    ...elementStub(),
    width: 960,
    height: 960,
    getContext() { return {}; },
  };
  const emblem = { ...elementStub(), querySelector() { return elementStub(); } };
  const sandbox = {
    URLSearchParams,
    location: { search: "" },
    document: {
      head: { querySelector() { return elementStub(); }, append() {} },
      createElement: elementStub,
      querySelector(selector: string) {
        if (selector === "#othello-board") return canvas;
        if (selector === ".brand-emblem svg") return emblem;
        return elementStub();
      },
      querySelectorAll() { return []; },
    },
    matchMedia() { return { matches: true }; },
    performance: { now() { return 0; } },
    requestAnimationFrame() { return 0; },
    console,
    Math,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nglobalThis.__othelloTest = {\n    createState, legalMoves, flipsFor, applyMove, selectComputerMove, scores,\n    getState: () => state, setState: (next) => { state = next; }\n  };`, sandbox);
  return (sandbox as typeof sandbox & { __othelloTest: any }).__othelloTest;
}

test("the actual Othello engine starts legally, flips pieces, alternates turns, and completes", async () => {
  const engine = await loadEngine();
  engine.setState(engine.createState());

  const opening = engine.legalMoves();
  const openingSquares = Array.from(opening, (move: any) => `${move.row},${move.column}`).sort();
  assert.deepEqual(openingSquares, ["2,3", "3,2", "4,5", "5,4"]);

  assert.equal(engine.applyMove(opening[0], false), true);
  const afterFirst = engine.getState();
  assert.equal(afterFirst.move, 1);
  assert.equal(afterFirst.player, -1);
  assert.deepEqual({ ...engine.scores() }, { dark: 4, light: 1 });
  assert.ok(engine.legalMoves().length > 0);

  let safety = 0;
  while (!engine.getState().complete && safety < 80) {
    const move = engine.selectComputerMove();
    assert.ok(move, `expected a legal move at ply ${safety + 2}`);
    assert.equal(engine.applyMove(move, false), true);
    safety += 1;
  }

  assert.equal(engine.getState().complete, true);
  const final = { ...engine.scores() };
  assert.ok(final.dark + final.light >= 4 && final.dark + final.light <= 64);
  assert.ok(safety > 20);
});

test("the player flow uses universal navigation, game-specific menus, and storage-independent Othello turns", async () => {
  const launcher = await read("public/auth-launcher.js");
  const navigation = await read("public/gameframe-nav.js");
  const hub = await read("public/game-hub.js");
  const app4 = await read("public/othello-fidelity-app-4.js");
  const othelloMenu = await read("public/othello-game-menu.js");
  const browserRegression = await read("test/browser/othello-gameplay.spec.mjs");
  const packageJson = JSON.parse(await read("package.json"));

  assert.ok(launcher.indexOf("gameframe-nav.js") < launcher.indexOf("await import(entry)"));
  assert.match(navigation, />Home</);
  assert.match(navigation, /Achievements/);
  assert.match(navigation, /Coming soon/);
  assert.doesNotMatch(navigation, />Games</);
  assert.match(navigation, /gameframe:before-home/);

  assert.match(hub, /document\.createElement\("a"\)/);
  assert.match(hub, /card\.href = game\.href/);
  assert.match(hub, /class=\"game-card-play\"/);
  assert.doesNotMatch(hub, /activateLibraryCard|playLink\.click/);
  assert.match(hub, /\?game=tic-tac-toe&menu=1/);
  assert.match(hub, /\?game=american-checkers&menu=1/);
  assert.match(hub, /modeGrid\.hidden = true/);
  assert.match(hub, /Choose how to play/);
  assert.match(hub, /game-hub-topbar/);

  assert.match(app4, /query\.get\("state"\) \|\| "start"/);
  assert.match(app4, /othello-game-menu\.js/);
  assert.match(app4, /othello-launcher\.js/);
  assert.match(othelloMenu, /Challenge OthelloBot/);
  assert.match(othelloMenu, /id="othello-play-bot"/);
  assert.match(othelloMenu, /Pass &amp; play/);
  assert.match(othelloMenu, /function markStorageUnavailable/);
  assert.match(othelloMenu, /try \{\n      localStorage\.setItem/);
  assert.match(othelloMenu, /catch \{\n      markStorageUnavailable\(\)/);
  assert.match(othelloMenu, /scheduleBotTurn/);
  assert.match(othelloMenu, /mode !== "bot"/);
  assert.match(othelloMenu, /startBot/);
  assert.match(othelloMenu, /state\.player === LIGHT/);
  assert.match(othelloMenu, /demoMove\?\.remove/);
  assert.match(othelloMenu, /document\.addEventListener\("gameframe:before-home", persist\)/);

  assert.match(browserRegression, /pass-and-play alternates legal turns/);
  assert.match(browserRegression, /persistence is unavailable/);
  assert.match(browserRegression, /Storage\.prototype\.setItem/);
  assert.match(browserRegression, /"2 \/ 60"/);

  for (const file of [
    "public/gameframe-nav.js",
    "public/game-hub.js",
    "public/othello-launcher.js",
    "public/othello-game-menu.js",
    "public/othello-fidelity-app-4.js",
  ]) {
    assert.match(packageJson.scripts["check:browser"], new RegExp(file.replaceAll("/", "\\/")));
  }
});
