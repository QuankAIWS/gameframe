import { readFile, writeFile } from "node:fs/promises";

async function patch(path, from, to) {
  const text = await readFile(path, "utf8");
  if (!text.includes(from)) throw new Error(`Patch anchor missing in ${path}`);
  await writeFile(path, text.replace(from, to));
}

await patch("src/server/monster-master-match-service.ts",
`import {
  isMonsterMasterArenaState,
  monsterMasterArenaDefinition,
} from "../games/monster-master/arena-definition.ts";`,
`import {
  createMonsterMasterArenaState,
  isMonsterMasterArenaState,
  monsterMasterArenaDefinition,
} from "../games/monster-master/arena-definition.ts";
import {
  createDeterministicMonsterMasterArenaRoster,
  normalizeMonsterMasterArenaRosterSelection,
} from "../games/monster-master/arena-roster.ts";`);

await patch("src/server/monster-master-match-service.ts",
`export interface MonsterMasterMatchServiceOptions {`,
`export interface MonsterMasterArenaMatchRequest {
  playerId: string;
  roster: unknown;
}

export interface MonsterMasterMatchServiceOptions {`);

await patch("src/server/monster-master-match-service.ts",
`    requestedMatchId?: string,
    initialState?: MonsterMasterState,
  ): Promise<PublicMonsterMasterMatchView> {`,
`    requestedMatchId?: string,
    initialState?: MonsterMasterState,
    arenaRequest?: MonsterMasterArenaMatchRequest,
  ): Promise<PublicMonsterMasterMatchView> {`);

await patch("src/server/monster-master-match-service.ts",
`    // Standalone Arena matches use the Arena rules profile. Explicitly configured
    // states (used by campaign-facing encounter infrastructure) retain the base
    // Monster Master definition and are not silently reshaped by Arena evolution.
    const definition = initialState ? monsterMasterDefinition : monsterMasterArenaDefinition;
    const session = new MatchSession({
      matchId,
      definition,
      playerIds: normalizedPlayers,
      ...(initialState
        ? {
            snapshot: {
              matchId,
              gameId: definition.gameId,
              playerIds: normalizedPlayers,
              revision: 0,
              initialState,
              state: initialState,
              events: [],
            },
          }
        : {}),
    });`,
`    let arenaInitialState: MonsterMasterState | undefined;
    if (!initialState && arenaRequest) {
      if (!normalizedPlayers.includes(arenaRequest.playerId)) {
        const error = new Error("Monster Master Arena roster owner must occupy a match seat.");
        Object.assign(error, { code: "invalid_arena_roster" });
        throw error;
      }
      const rosterSelections = {
        [arenaRequest.playerId]: normalizeMonsterMasterArenaRosterSelection(arenaRequest.roster),
      };
      if (normalizedPlayers.includes(this.#bot.agentId) && arenaRequest.playerId !== this.#bot.agentId) {
        rosterSelections[this.#bot.agentId] = createDeterministicMonsterMasterArenaRoster(\`${"${matchId}:${this.#bot.agentId}"}\`);
      }
      arenaInitialState = createMonsterMasterArenaState(normalizedPlayers, { rosterSelections });
    }

    // Campaign-facing configured states retain the base rules definition. Standalone
    // Arena loadouts are server-materialized from content IDs so clients cannot inject stats.
    const definition = initialState ? monsterMasterDefinition : monsterMasterArenaDefinition;
    const configuredState = initialState ?? arenaInitialState;
    const session = new MatchSession({
      matchId,
      definition,
      playerIds: normalizedPlayers,
      ...(configuredState
        ? {
            snapshot: {
              matchId,
              gameId: definition.gameId,
              playerIds: normalizedPlayers,
              revision: 0,
              initialState: configuredState,
              state: configuredState,
              events: [],
            },
          }
        : {}),
    });`);

await patch("src/server/in-memory-match-service.ts",
`import { MonsterMasterMatchService, type PublicMonsterMasterMatchView } from "./monster-master-match-service.ts";`,
`import {
  MonsterMasterMatchService,
  type MonsterMasterArenaMatchRequest,
  type PublicMonsterMasterMatchView,
} from "./monster-master-match-service.ts";`);

await patch("src/server/in-memory-match-service.ts",
`  async createMatch(gameId: string, playerIds: readonly string[], requestedMatchId?: string): Promise<PublicGameMatchView> {`,
`  async createMatch(
    gameId: string,
    playerIds: readonly string[],
    requestedMatchId?: string,
    monsterMasterArena?: MonsterMasterArenaMatchRequest,
  ): Promise<PublicGameMatchView> {`);

await patch("src/server/in-memory-match-service.ts",
`: await this.#monsterMaster.createMatch(playerIds, matchId);`,
`: await this.#monsterMaster.createMatch(playerIds, matchId, undefined, monsterMasterArena);`);

await patch("src/server/http-server.ts",
`        const gameId = String(body.gameId ?? "tic-tac-toe");
        const view = await matchService.createMatch(gameId, playerIds);`,
`        const gameId = String(body.gameId ?? "tic-tac-toe");
        const monsterMasterArena = gameId === "monster-master-duel" && body.monsterMasterArena
          ? { playerId: principal.playerId, roster: body.monsterMasterArena }
          : undefined;
        const view = await matchService.createMatch(gameId, playerIds, undefined, monsterMasterArena);`);

await patch("src/cloudflare/worker-router.ts",
`              gameId: String(body.gameId ?? "tic-tac-toe"),
            }),`,
`              gameId: String(body.gameId ?? "tic-tac-toe"),
              monsterMasterArena: body.monsterMasterArena
                ? { playerId: principal.playerId, roster: body.monsterMasterArena }
                : undefined,
            }),`);

await patch("src/cloudflare/match-object-runtime.ts",
`        const gameId = this.#normalizeGameId(String(body.gameId ?? "tic-tac-toe"));
        const view = gameId === "tic-tac-toe"`,
`        const gameId = this.#normalizeGameId(String(body.gameId ?? "tic-tac-toe"));
        const arenaInput = record(body.monsterMasterArena);
        const monsterMasterArena = Object.keys(arenaInput).length
          ? { playerId: String(arenaInput.playerId ?? ""), roster: arenaInput.roster }
          : undefined;
        const view = gameId === "tic-tac-toe"`);

await patch("src/cloudflare/match-object-runtime.ts",
`: await this.#monsterMaster.createMatch(playerIds, matchId);`,
`: await this.#monsterMaster.createMatch(playerIds, matchId, undefined, monsterMasterArena);`);
