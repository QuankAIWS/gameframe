import { DurableObject } from "cloudflare:workers";
import { json } from "./http-utils.ts";
import { InvitationObjectRuntime } from "./invitation-object-runtime.ts";
import { GameFrameMatchObjectRuntime } from "./match-object-runtime.ts";
import { MatchSocketHub } from "./match-socket-hub.ts";
import { createRpgEdgeGameFrameWorker } from "./rpg-edge-worker.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

// The class name remains migration-stable for the existing Durable Object binding.
// Its internal runtime now dispatches every supported GameFrame game and invitation rendezvous.
export class TicTacToeMatchDurableObject extends DurableObject<GameFrameWorkerEnv> {
  readonly #runtime: GameFrameMatchObjectRuntime;
  readonly #invitations: InvitationObjectRuntime;
  readonly #sockets: MatchSocketHub;

  constructor(ctx: DurableObjectState, env: GameFrameWorkerEnv) {
    super(ctx, env);
    this.#runtime = new GameFrameMatchObjectRuntime(ctx.storage, undefined, {
      onMatchUpdated: async (matchId) => this.#sockets.broadcast(matchId),
    });
    this.#invitations = new InvitationObjectRuntime(ctx.storage);
    this.#sockets = new MatchSocketHub(ctx, (matchId, playerId) => (
      this.#runtime.view(matchId, playerId)
    ));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/invitation/")) {
      return this.#invitations.fetch(request);
    }
    if (request.method === "GET" && url.pathname === "/events") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return json(426, {
          error: "upgrade_required",
          message: "This endpoint requires a WebSocket upgrade.",
        });
      }

      const matchId = String(url.searchParams.get("matchId") ?? "");
      const playerId = String(url.searchParams.get("playerId") ?? "");
      const pair = new WebSocketPair();
      await this.#sockets.attach(pair[1], matchId, playerId);
      return new Response(null, {
        status: 101,
        webSocket: pair[0],
      });
    }

    return this.#runtime.fetch(request);
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    return this.#sockets.handleMessage(socket, message);
  }

  webSocketClose(): void {
    // Cloudflare removes disconnected sockets from getWebSockets automatically.
  }

  webSocketError(): void {
    // A later observability slice will record transport failures without mutating match state.
  }
}

export default createRpgEdgeGameFrameWorker();
