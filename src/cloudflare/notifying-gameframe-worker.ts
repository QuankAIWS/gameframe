import { deliverChallengeBestEffort, type ChallengeNotifier } from "./challenge-notification-port.ts";
import type { PublicMatchInvitation } from "./invitation-object-runtime.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";
import { createGameFrameWorker } from "./worker-router.ts";

export function createNotifyingGameFrameWorker(notifier?: ChallengeNotifier) {
  const gameFrame = createGameFrameWorker();
  return {
    async fetch(request: Request, env: GameFrameWorkerEnv): Promise<Response> {
      const response = await gameFrame.fetch(request, env);
      const url = new URL(request.url);
      if (request.method !== "POST" || url.pathname !== "/api/invitations" || response.status !== 201) {
        return response;
      }

      const body = await response.clone().json().catch(() => ({})) as {
        invitation?: PublicMatchInvitation;
      };
      if (body.invitation) {
        await deliverChallengeBestEffort(notifier, env, {
          origin: url.origin,
          invitation: body.invitation,
        });
      }
      return response;
    },
  };
}
