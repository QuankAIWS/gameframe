import { DurableObject } from "cloudflare:workers";
import { json } from "./http-utils.ts";
import { InvitationObjectRuntime } from "./invitation-object-runtime.ts";
import { GameFrameMatchObjectRuntime } from "./match-object-runtime.ts";
import { MatchSocketHub } from "./match-socket-hub.ts";
import { PlayerEventSocketHub } from "./player-event-socket-hub.ts";
import { PlayerPlatformThemeRuntime } from "./player-platform-theme-runtime.ts";
import { CascadeTelemetryObjectRuntime } from "./cascade-telemetry-object-runtime.ts";
import { FamilyAuthObjectRuntime } from "./family-auth-object-runtime.ts";
import { familyAuthEdgeRoute, handleFamilyAuthEdge } from "./family-auth-edge.ts";
import { createRpgEdgeGameFrameWorker } from "./rpg-edge-worker.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

// The class name remains migration-stable for the existing Durable Object binding.
// Its internal runtime now dispatches every supported GameFrame game, invitation
// rendezvous, lightweight player-platform indexes, playtest telemetry, and the
// private family trusted-device registry.
export class TicTacToeMatchDurableObject extends DurableObject<GameFrameWorkerEnv> {
  readonly #runtime: GameFrameMatchObjectRuntime;
  readonly #invitations: InvitationObjectRuntime;
  readonly #players: PlayerPlatformThemeRuntime;
  readonly #playerEvents: PlayerEventSocketHub;
  readonly #telemetry: CascadeTelemetryObjectRuntime;
  readonly #familyAuth: FamilyAuthObjectRuntime;
  readonly #sockets: MatchSocketHub;

  constructor(ctx: DurableObjectState, env: GameFrameWorkerEnv) {
    super(ctx, env);
    this.#runtime = new GameFrameMatchObjectRuntime(ctx.storage, undefined, {
      onMatchUpdated: async (matchId) => this.#sockets.broadcast(matchId),
    });
    this.#invitations = new InvitationObjectRuntime(ctx.storage);
    this.#playerEvents = new PlayerEventSocketHub(ctx);
    this.#players = new PlayerPlatformThemeRuntime(ctx.storage, {
      onUpdated: (topics) => this.#playerEvents.broadcast(topics),
    });
    this.#telemetry = new CascadeTelemetryObjectRuntime(ctx.storage);
    this.#familyAuth = new FamilyAuthObjectRuntime(ctx.storage);
    this.#sockets = new MatchSocketHub(ctx, (matchId, playerId) => (
      this.#runtime.view(matchId, playerId)
    ));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/invitation/")) return this.#invitations.fetch(request);
    if (request.method === "GET" && url.pathname === "/player/events") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return json(426, { error: "upgrade_required", message: "This endpoint requires a WebSocket upgrade." });
      }
      const playerId = String(url.searchParams.get("playerId") ?? "").trim();
      if (!playerId) {
        return json(400, { error: "player_platform_invalid", message: "A player ID is required for player events." });
      }
      const pair = new WebSocketPair();
      this.#playerEvents.attach(pair[1], playerId);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (url.pathname.startsWith("/directory/") || url.pathname.startsWith("/player/")) return this.#players.fetch(request);
    if (url.pathname.startsWith("/telemetry/")) return this.#telemetry.fetch(request);
    if (url.pathname.startsWith("/family/")) return this.#familyAuth.fetch(request);
    if (request.method === "GET" && url.pathname === "/events") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return json(426, { error: "upgrade_required", message: "This endpoint requires a WebSocket upgrade." });
      }
      const matchId = String(url.searchParams.get("matchId") ?? "");
      const playerId = String(url.searchParams.get("playerId") ?? "");
      const pair = new WebSocketPair();
      await this.#sockets.attach(pair[1], matchId, playerId);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return this.#runtime.fetch(request);
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> | void {
    if (this.#playerEvents.owns(socket)) {
      this.#playerEvents.handleMessage(socket, message);
      return;
    }
    return this.#sockets.handleMessage(socket, message);
  }

  webSocketClose(): void {}
  webSocketError(): void {}
}

const gameFrameWorker = createRpgEdgeGameFrameWorker();

export default {
  async fetch(request: Request, env: GameFrameWorkerEnv): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (familyAuthEdgeRoute(pathname)) return handleFamilyAuthEdge(request, env);
    return gameFrameWorker.fetch(request, env);
  },
};