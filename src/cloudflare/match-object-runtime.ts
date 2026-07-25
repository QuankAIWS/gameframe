import { DurableObjectMatchStore } from "./durable-object-match-store.ts";
import { errorResponse, json, readJson } from "./http-utils.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";
import { TicTacToeMatchService } from "../server/tic-tac-toe-match-service.ts";

export class TicTacToeMatchObjectRuntime {
  readonly #service: TicTacToeMatchService;
  #tail: Promise<void> = Promise.resolve();

  constructor(storage: DurableStorageLike, idGenerator: () => string = () => crypto.randomUUID()) {
    this.#service = new TicTacToeMatchService({
      store: new DurableObjectMatchStore(storage),
      idGenerator,
    });
  }

  fetch(request: Request): Promise<Response> {
    const execute = async () => this.#handle(request);
    const result = this.#tail.then(execute, execute);
    this.#tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async #handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (request.method === "POST" && url.pathname === "/initialize") {
        const body = await readJson(request);
        const matchId = String(body.matchId ?? "").trim();
        const humanPlayerId = String(body.humanPlayerId ?? "").trim();
        return json(201, await this.#service.createHumanVsTheo(humanPlayerId, matchId));
      }

      if (request.method === "GET" && url.pathname === "/view") {
        return json(200, await this.#service.view(
          String(url.searchParams.get("matchId") ?? ""),
          String(url.searchParams.get("playerId") ?? ""),
        ));
      }

      if (request.method === "POST" && url.pathname === "/actions") {
        const body = await readJson(request);
        return json(200, await this.#service.submitHumanAction({
          matchId: String(body.matchId ?? ""),
          playerId: String(body.playerId ?? ""),
          actionId: String(body.actionId ?? ""),
          expectedRevision: Number(body.expectedRevision),
          action: {
            type: "place",
            cell: Number((body.action as { cell?: unknown } | undefined)?.cell),
          },
        }));
      }

      return json(404, { error: "not_found" });
    } catch (error) {
      return errorResponse(error);
    }
  }
}
