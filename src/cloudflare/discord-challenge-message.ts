export interface DiscordChallengeMessageInput {
  invitationId: string;
  targetPlayerId: string;
  inviterDisplayName: string | null;
  gameLabel: string;
  origin: string;
}

function boundedText(value: string | null | undefined, fallback: string, maximum: number): string {
  const normalized = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return (normalized || fallback).slice(0, maximum);
}

function fnv1a(value: string, seed: number): string {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function discordRecipientId(playerId: string): string | null {
  const match = /^discord:(\d+)$/.exec(playerId.trim());
  return match?.[1] ?? null;
}

export function discordChallengeNonce(invitationId: string): string {
  return `gf-${fnv1a(invitationId, 0x811c9dc5)}${fnv1a(invitationId, 0x9e3779b9)}`;
}

export function discordChallengeMessage(input: DiscordChallengeMessageInput) {
  const recipientId = discordRecipientId(input.targetPlayerId);
  if (!recipientId) return null;
  const inviter = boundedText(input.inviterDisplayName, "A GameFrame player", 80);
  const game = boundedText(input.gameLabel, "a GameFrame match", 80);
  const matchesUrl = new URL("/matches.html", input.origin).toString();
  return {
    recipientId,
    content: `${inviter} challenged you to ${game}. Open GameFrame Matches: ${matchesUrl}`,
    allowedMentions: { parse: [] as string[] },
    nonce: discordChallengeNonce(input.invitationId),
  };
}
