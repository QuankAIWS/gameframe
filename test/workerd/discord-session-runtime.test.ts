import { exports as workerExports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { SignedSessionCodec } from "../../src/auth/signed-session.ts";

const clientId = "123456789012345678";
const codec = new SignedSessionCodec("gf0002-workerd-session-secret-0123456789abcdef");

function cookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
}

describe("Discord identity boundary in the real workerd runtime", () => {
  it("advertises Discord OAuth sessions and creates a signed website transaction", async () => {
    const health = await workerExports.default.fetch(new Request("https://games.example/api/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      authentication: "discord-oauth-session",
      discordActivity: true,
    });

    const start = await workerExports.default.fetch(new Request(
      "https://games.example/auth/discord/start?returnTo=%2Fcombat.html",
    ));
    expect(start.status).toBe(302);
    const location = new URL(start.headers.get("location") ?? "");
    expect(location.origin).toBe("https://discord.com");
    expect(location.searchParams.get("client_id")).toBe(clientId);
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://games.example/auth/discord/callback",
    );
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(cookies(start)[0]).toContain("gameframe_discord_oauth=");
    expect(cookies(start)[0]).toContain("SameSite=Lax");
  });

  it("reads a signed Discord principal and clears its website session", async () => {
    const token = await codec.issue({
      playerId: "discord:111",
      source: "discord",
      displayName: "Workers Tester",
      avatarUrl: "https://cdn.discordapp.com/avatars/111/hash.png?size=128",
    });
    const cookie = `gameframe_session=${token}`;
    const session = await workerExports.default.fetch(new Request(
      "https://games.example/api/session",
      { headers: { cookie } },
    ));
    expect(session.status).toBe(200);
    expect(await session.json()).toEqual({
      authenticated: true,
      playerId: "discord:111",
      source: "discord",
      displayName: "Workers Tester",
      avatarUrl: "https://cdn.discordapp.com/avatars/111/hash.png?size=128",
    });

    const logout = await workerExports.default.fetch(new Request(
      "https://games.example/auth/logout",
      { method: "POST", headers: { cookie } },
    ));
    expect(logout.status).toBe(200);
    expect(cookies(logout)[0]).toContain("Max-Age=0");
    expect(cookies(logout)[0]).toContain("SameSite=Lax");
  });

  it("issues a partitioned OAuth transaction for Discord Activity launch", async () => {
    const response = await workerExports.default.fetch(new Request(
      `https://${clientId}.discordsays.com/auth/discord/activity/config`,
    ));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      clientId,
      scopes: ["identify"],
    });
    expect(cookies(response)[0]).toContain(`Domain=${clientId}.discordsays.com`);
    expect(cookies(response)[0]).toContain("SameSite=None");
    expect(cookies(response)[0]).toContain("Partitioned");
  });
});
