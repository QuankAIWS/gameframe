import { env, exports as workerExports } from "cloudflare:workers";
import { evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { SignedSessionCodec } from "../../src/auth/signed-session.ts";

const sessionSecret = "gf0002-workerd-session-secret-0123456789abcdef";
const codec = new SignedSessionCodec(sessionSecret);

async function cookieFor(playerId: string): Promise<string> {
  const token = await codec.issue({
    playerId,
    source: "discord",
    displayName: playerId,
  });
  return `gameframe_session=${token}`;
}

async function workerFetch(
  path: string,
  playerId: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("cookie", await cookieFor(playerId));
  return workerExports.default.fetch(new Request(`https://games.example${path}`, {
    ...init,
    headers,
  }));
}

function objectStub(name: string): any {
  const matches = (env as any).MATCHES;
  return matches.get(matches.idFromName(name));
}

describe("authenticated match invitations in the real workerd runtime", () => {
  it("claims, persists, and restores a verified two-human match", async () => {
    const createdResponse = await workerFetch("/api/invitations", "discord:111", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameId: "american-checkers" }),
    });
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json() as any;
    expect(created.invitation.status).toBe("pending");
    expect(created.invitation.inviter.playerId).toBe("discord:111");
    const token = new URL(created.inviteUrl).searchParams.get("token");
    expect(token).toBeTruthy();

    const claimedResponse = await workerFetch("/api/invitations/claim", "discord:222", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(claimedResponse.status).toBe(200);
    const claimed = await claimedResponse.json() as any;
    expect(claimed.invitation.status).toBe("claimed");
    expect(claimed.invitation.claimant.playerId).toBe("discord:222");
    expect(claimed.resumePath).toContain(`match=${encodeURIComponent(claimed.invitation.matchId)}`);

    const matchId = claimed.invitation.matchId as string;
    const invitationId = claimed.invitation.invitationId as string;
    for (const playerId of ["discord:111", "discord:222"]) {
      const match = await workerFetch(`/api/matches/${encodeURIComponent(matchId)}`, playerId);
      expect(match.status).toBe(200);
      expect(await match.json()).toMatchObject({
        gameId: "american-checkers",
        matchId,
        playerIds: ["discord:111", "discord:222"],
      });
    }

    await evictDurableObject(objectStub(`invite:${invitationId}`));
    await evictDurableObject(objectStub(matchId));

    const restoredInvitation = await workerFetch(
      `/api/invitations/${encodeURIComponent(invitationId)}`,
      "discord:111",
    );
    expect(restoredInvitation.status).toBe(200);
    expect(await restoredInvitation.json()).toMatchObject({
      invitation: {
        status: "claimed",
        matchId,
      },
      resumePath: claimed.resumePath,
    });

    const restoredMatch = await workerFetch(
      `/api/matches/${encodeURIComponent(matchId)}`,
      "discord:222",
    );
    expect(restoredMatch.status).toBe(200);
    expect(await restoredMatch.json()).toMatchObject({
      matchId,
      playerIds: ["discord:111", "discord:222"],
    });
  });

  it("rejects direct Discord human-seat creation while preserving Theo matches", async () => {
    const human = await workerFetch("/api/matches", "discord:111", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameId: "tic-tac-toe",
        playerIds: ["discord:111", "discord:222"],
      }),
    });
    expect(human.status).toBe(403);

    const theo = await workerFetch("/api/matches", "discord:111", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameId: "tic-tac-toe",
        playerIds: ["discord:111", "theo"],
      }),
    });
    expect(theo.status).toBe(201);
    expect(await theo.json()).toMatchObject({
      gameId: "tic-tac-toe",
      playerIds: ["discord:111", "theo"],
    });
  });
});
