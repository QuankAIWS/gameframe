import { DurableObject } from "cloudflare:workers";
import { TicTacToeMatchObjectRuntime } from "./match-object-runtime.ts";
import { createGameFrameWorker } from "./worker-router.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

export class TicTacToeMatchDurableObject extends DurableObject<GameFrameWorkerEnv> {
  readonly #runtime: TicTacToeMatchObjectRuntime;

  constructor(ctx: DurableObjectState, env: GameFrameWorkerEnv) {
    super(ctx, env);
    this.#runtime = new TicTacToeMatchObjectRuntime(ctx.storage);
  }

  fetch(request: Request): Promise<Response> {
    return this.#runtime.fetch(request);
  }
}

export default createGameFrameWorker();
