import type { PublicMatchInvitation } from "./invitation-object-runtime.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

export interface ChallengeNotificationInput {
  origin: string;
  invitation: PublicMatchInvitation;
}

export type ChallengeNotifier = (
  env: GameFrameWorkerEnv,
  input: ChallengeNotificationInput,
) => Promise<boolean>;

export async function deliverChallengeBestEffort(
  notifier: ChallengeNotifier | undefined,
  env: GameFrameWorkerEnv,
  input: ChallengeNotificationInput,
): Promise<boolean> {
  if (!notifier || !input.invitation.targetPlayerId) return false;
  try {
    return await notifier(env, input);
  } catch {
    return false;
  }
}
