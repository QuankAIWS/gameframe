import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import type { PublicMatchInvitation } from "./invitation-object-runtime.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

export async function declineInvitation(
  env: GameFrameWorkerEnv,
  invitationId: string,
  principal: AuthenticatedPrincipal,
): Promise<PublicMatchInvitation> {
  const stub = env.MATCHES.get(env.MATCHES.idFromName(`invite:${invitationId}`));
  const response = await stub.fetch(new Request("https://invitation.internal/invitation/decline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invitationId, playerId: principal.playerId }),
  }));
  const body = await response.json().catch(() => ({})) as PublicMatchInvitation & {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw Object.assign(new Error(body.message ?? `Invitation decline failed with ${response.status}.`), {
      code: body.error ?? "invitation_internal_error",
    });
  }
  return body;
}
