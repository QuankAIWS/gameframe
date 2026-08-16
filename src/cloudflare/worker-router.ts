import { GAMEFRAME_BOT_PLAYER_ID } from "../agents/gameframe-bot.ts";
import {
  AuthenticationError,
  RejectingRequestAuthenticator,
  rejectIdentityClaim,
  requirePrincipalSeat,
  type AuthenticatedPrincipal,
  type RequestAuthenticator,
} from "../auth/request-authenticator.ts";
import {
  DiscordOAuthClient,
  clearActivityOAuthStateCookie,
  clearWebsiteOAuthStateCookie,
  createActivityOAuthStateCookie,
  createWebsiteOAuthStateCookie,
  safeReturnTo,
} from "../auth/discord-oauth.ts";
import { invitationTargetPlayerId } from "../auth/match-invitation.ts";
import {
  SignedCookieSessionAuthenticator,
  SignedSessionCodec,
  clearDiscordActivitySessionCookie,
  clearWebsiteSessionCookie,
  createDiscordActivitySessionCookie,
  createWebsiteSessionCookie,
} from "../auth/signed-session.ts";
import { InvitationCoordinator } from "./invitation-coordinator.ts";
import { declineInvitation } from "./invitation-decline.ts";
import { errorResponse, json, readJson } from "./http-utils.ts";
import {
  indexInvitation,
  indexMatchView,
  listKnownPlayers,
  openPlayerEventStream,
  readPlayerFeed,
  touchPlayerDirectory,
  type IndexedMatchView,
} from "./player-platform-coordinator.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

interface WorkerRouterOptions {
  idGenerator?: () => string;
  authenticator?: RequestAuthenticator;
}

type MatchOperation = "view" | "actions" | "events";
type InvitationOperation = "view" | "cancel" | "decline";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function publicMatchRoute(pathname: string): { matchId: string; operation: MatchOperation } | null {
  const match = /^\/api\/matches\/([^/]+)(?:\/(actions|events))?$/.exec(pathname);
  if (!match) return null;
  return {
    matchId: decodeURIComponent(match[1]),
    operation: (match[2] as MatchOperation | undefined) ?? "view",
  };
}

function invitationRoute(pathname: string): { invitationId: string; operation: InvitationOperation } | null {
  const match = /^\/api\/invitations\/([^/]+)(?:\/(cancel|decline))?$/.exec(pathname);
  if (!match) return null;
  return {
    invitationId: decodeURIComponent(match[1]),
    operation: (match[2] as InvitationOperation | undefined) ?? "view",
  };
}

function stubFor(env: GameFrameWorkerEnv, matchId: string) {
  return env.MATCHES.get(env.MATCHES.idFromName(matchId));
}

function callbackUri(url: URL): string {
  return `${url.origin}/auth/discord/callback`;
}

function activityHost(clientId: string): string {
  return `${clientId}.discordsays.com`;
}

function sessionResponse(principal: Awaited<ReturnType<RequestAuthenticator["authenticate"]>>) {
  return {
    authenticated: true,
    playerId: principal.playerId,
    source: principal.source,
    displayName: principal.displayName ?? null,
    avatarUrl: principal.avatarUrl ?? null,
  };
}

function requireDirectMatchCreationPolicy(
  principal: AuthenticatedPrincipal,
  playerIds: readonly string[],
): void {
  requirePrincipalSeat(principal, playerIds);
  if (principal.source !== "discord") return;
  const validBotMatch = playerIds.length === 2
    && playerIds.filter((playerId) => playerId === principal.playerId).length === 1
    && playerIds.filter((playerId) => playerId === GAMEFRAME_BOT_PLAYER_ID).length === 1;
  if (!validBotMatch) {
    throw new AuthenticationError(
      "forbidden",
      "Discord-authenticated human matches require a signed invitation and second-user claim.",
    );
  }
}

async function internalMatchView(response: Response): Promise<IndexedMatchView> {
  const body = await response.json().catch(() => ({})) as IndexedMatchView & { error?: string; message?: string };
  if (!response.ok) {
    throw Object.assign(new Error(body.message ?? `Internal match request failed with ${response.status}.`), {
      code: body.error ?? "match_internal_error",
    });
  }
  return body;
}

async function loadMatchForIndex(env: GameFrameWorkerEnv, matchId: string, playerId: string) {
  const internal = new URL("https://match.internal/view");
  internal.searchParams.set("matchId", matchId);
  internal.searchParams.set("playerId", playerId);
  const view = await internalMatchView(await stubFor(env, matchId).fetch(new Request(internal)));
  await indexMatchView(env, view);
  return view;
}

export function createGameFrameWorker(options: WorkerRouterOptions = {}) {
  const idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
  let cachedSessionAuthenticator: { secret: string; authenticator: RequestAuthenticator } | null = null;
  let cachedSessionCodec: { secret: string; codec: SignedSessionCodec } | null = null;

  function sessionCodecFor(env: GameFrameWorkerEnv): SignedSessionCodec {
    const secret = env.SESSION_SECRET ?? "";
    if (!cachedSessionCodec || cachedSessionCodec.secret !== secret) {
      cachedSessionCodec = { secret, codec: new SignedSessionCodec(secret) };
    }
    return cachedSessionCodec.codec;
  }

  function authenticatorFor(env: GameFrameWorkerEnv): RequestAuthenticator {
    if (options.authenticator) return options.authenticator;
    const secret = env.SESSION_SECRET?.trim() ?? "";
    if (!secret) {
      return new RejectingRequestAuthenticator(
        "Cloudflare game APIs require a configured Discord or service identity verifier.",
      );
    }
    if (!cachedSessionAuthenticator || cachedSessionAuthenticator.secret !== secret) {
      cachedSessionAuthenticator = {
        secret,
        authenticator: new SignedCookieSessionAuthenticator(sessionCodecFor(env)),
      };
    }
    return cachedSessionAuthenticator.authenticator;
  }

  function invitationsFor(env: GameFrameWorkerEnv): InvitationCoordinator {
    return new InvitationCoordinator(env, env.SESSION_SECRET ?? "", { idGenerator });
  }

  return {
    async fetch(request: Request, env: GameFrameWorkerEnv): Promise<Response> {
      try {
        const url = new URL(request.url);
        const authenticator = authenticatorFor(env);

        if (request.method === "GET" && url.pathname === "/api/health") {
          return json(200, {
            status: "ok",
            service: "scribbles-gameframe",
            runtime: "cloudflare",
            realtime: "websocket-hibernation",
            playerEvents: "websocket-hibernation",
            authentication: "discord-oauth-session",
            discordActivity: true,
            authenticatedInvitations: true,
            playerPlatform: true,
            games: [
              "tic-tac-toe",
              "american-checkers",
              "othello",
              "tactical-movement-canary",
              "tactical-combat-canary",
              "monster-master-duel",
            ],
          });
        }

        if (request.method === "GET" && url.pathname === "/auth/discord/start") {
          const oauth = new DiscordOAuthClient(env);
          const state = await oauth.stateCodec.issue(safeReturnTo(url.searchParams.get("returnTo")));
          const headers = new Headers({
            location: oauth.authorizationUrl(state, callbackUri(url)),
            "cache-control": "no-store",
          });
          headers.append("set-cookie", createWebsiteOAuthStateCookie(state));
          return new Response(null, { status: 302, headers });
        }

        if (request.method === "GET" && url.pathname === "/auth/discord/callback") {
          if (url.searchParams.get("error")) {
            throw Object.assign(new Error("Discord authorization was denied or cancelled."), {
              code: "discord_oauth_exchange_failed",
            });
          }
          const oauth = new DiscordOAuthClient(env);
          const state = String(url.searchParams.get("state") ?? "");
          const transaction = await oauth.validateState(request, state);
          const token = await oauth.exchangeCode(
            String(url.searchParams.get("code") ?? ""),
            callbackUri(url),
          );
          const principal = oauth.principalFor(await oauth.currentUser(token.access_token));
          const sessionToken = await sessionCodecFor(env).issue(principal, SESSION_TTL_SECONDS);
          const headers = new Headers({
            location: transaction.returnTo,
            "cache-control": "no-store",
          });
          headers.append("set-cookie", createWebsiteSessionCookie(sessionToken, {
            maxAgeSeconds: SESSION_TTL_SECONDS,
          }));
          headers.append("set-cookie", clearWebsiteOAuthStateCookie());
          return new Response(null, { status: 302, headers });
        }

        if (request.method === "GET" && url.pathname === "/auth/discord/activity/config") {
          const oauth = new DiscordOAuthClient(env);
          const state = await oauth.stateCodec.issue("/");
          return json(200, {
            clientId: oauth.clientId,
            state,
            scopes: ["identify"],
          }, {
            "set-cookie": createActivityOAuthStateCookie(state, oauth.clientId),
          });
        }

        if (request.method === "POST" && url.pathname === "/auth/discord/activity/session") {
          const oauth = new DiscordOAuthClient(env);
          const body = await readJson(request);
          await oauth.validateState(request, String(body.state ?? ""));
          const token = await oauth.exchangeCode(String(body.code ?? ""));
          const principal = oauth.principalFor(await oauth.currentUser(token.access_token));
          const sessionToken = await sessionCodecFor(env).issue(principal, SESSION_TTL_SECONDS);
          const headers = new Headers();
          headers.append("set-cookie", createDiscordActivitySessionCookie(sessionToken, {
            clientId: oauth.clientId,
            maxAgeSeconds: SESSION_TTL_SECONDS,
          }));
          headers.append("set-cookie", clearActivityOAuthStateCookie(oauth.clientId));
          return json(200, {
            access_token: token.access_token,
            token_type: token.token_type,
            expires_in: token.expires_in,
            session: sessionResponse(principal),
          }, headers);
        }

        if (request.method === "GET" && url.pathname === "/api/session") {
          const principal = await authenticator.authenticate(request);
          await touchPlayerDirectory(env, principal);
          return json(200, sessionResponse(principal));
        }

        if (request.method === "GET" && url.pathname === "/api/me/events") {
          const principal = await authenticator.authenticate(request);
          return openPlayerEventStream(env, principal.playerId, request);
        }

        if (request.method === "GET" && url.pathname === "/api/players") {
          const principal = await authenticator.authenticate(request);
          return json(200, await listKnownPlayers(env, principal.playerId));
        }

        if (request.method === "GET" && url.pathname === "/api/me/feed") {
          const principal = await authenticator.authenticate(request);
          return json(200, await readPlayerFeed(env, principal.playerId));
        }

        if (request.method === "POST" && url.pathname === "/auth/logout") {
          const clientId = env.DISCORD_CLIENT_ID?.trim() ?? "";
          const cookie = /^\d+$/.test(clientId) && url.hostname === activityHost(clientId)
            ? clearDiscordActivitySessionCookie(clientId)
            : clearWebsiteSessionCookie();
          return json(200, { authenticated: false }, { "set-cookie": cookie });
        }

        if (request.method === "POST" && url.pathname === "/api/invitations") {
          const principal = await authenticator.authenticate(request);
          await touchPlayerDirectory(env, principal);
          const body = await readJson(request);
          const created = await invitationsFor(env).create(url.origin, principal, body);
          const targetPlayerId = invitationTargetPlayerId(body.targetPlayerId, body.targetDiscordUserId);
          await indexInvitation(
            env,
            created.invitation,
            [principal.playerId, targetPlayerId ?? ""],
            { claimToken: created.token, claimTokenPlayerId: targetPlayerId ?? null },
          );
          return json(201, created);
        }

        if (request.method === "POST" && url.pathname === "/api/invitations/claim") {
          const principal = await authenticator.authenticate(request);
          await touchPlayerDirectory(env, principal);
          const body = await readJson(request);
          const claimed = await invitationsFor(env).claim(principal, String(body.token ?? ""));
          const invitation = claimed.invitation;
          await indexInvitation(env, invitation, [invitation.inviter.playerId, principal.playerId]);
          if (invitation.matchId) {
            await loadMatchForIndex(env, invitation.matchId, invitation.inviter.playerId);
          }
          return json(200, claimed);
        }

        const inviteRoute = invitationRoute(url.pathname);
        if (inviteRoute && request.method === "GET" && inviteRoute.operation === "view") {
          const principal = await authenticator.authenticate(request);
          return json(200, await invitationsFor(env).view(inviteRoute.invitationId, principal));
        }
        if (inviteRoute && request.method === "POST" && inviteRoute.operation === "cancel") {
          const principal = await authenticator.authenticate(request);
          const cancelled = await invitationsFor(env).cancel(inviteRoute.invitationId, principal);
          await indexInvitation(env, cancelled.invitation, [principal.playerId]);
          return json(200, cancelled);
        }
        if (inviteRoute && request.method === "POST" && inviteRoute.operation === "decline") {
          const principal = await authenticator.authenticate(request);
          const declined = await declineInvitation(env, inviteRoute.invitationId, principal);
          const feedInvitation = { ...declined, status: "cancelled" as const };
          await indexInvitation(env, feedInvitation, [declined.inviter.playerId, principal.playerId]);
          return json(200, { invitation: declined, resumePath: null });
        }

        if (request.method === "POST" && url.pathname === "/api/matches") {
          const principal = await authenticator.authenticate(request);
          await touchPlayerDirectory(env, principal);
          const body = await readJson(request);
          const playerIds = Array.isArray(body.playerIds)
            ? body.playerIds.map((playerId) => String(playerId))
            : [];
          requireDirectMatchCreationPolicy(principal, playerIds);
          const matchId = idGenerator();
          const view = await internalMatchView(await stubFor(env, matchId).fetch(new Request("https://match.internal/initialize", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              matchId,
              playerIds,
              gameId: String(body.gameId ?? "tic-tac-toe"),
              monsterMasterArena: body.monsterMasterArena
                ? { playerId: principal.playerId, roster: body.monsterMasterArena }
                : undefined,
            }),
          })));
          await indexMatchView(env, view);
          return json(201, view);
        }

        const route = publicMatchRoute(url.pathname);
        if (route && request.method === "GET" && route.operation === "view") {
          const principal = await authenticator.authenticate(request);
          rejectIdentityClaim(principal, url.searchParams.get("playerId"));
          const internal = new URL("https://match.internal/view");
          internal.searchParams.set("matchId", route.matchId);
          internal.searchParams.set("playerId", principal.playerId);
          const view = await internalMatchView(await stubFor(env, route.matchId).fetch(new Request(internal)));
          return json(200, view);
        }

        if (route && request.method === "POST" && route.operation === "actions") {
          const principal = await authenticator.authenticate(request);
          const body = await readJson(request);
          rejectIdentityClaim(principal, body.playerId);
          const view = await internalMatchView(await stubFor(env, route.matchId).fetch(new Request("https://match.internal/actions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...body, matchId: route.matchId, playerId: principal.playerId }),
          })));
          await indexMatchView(env, view);
          return json(200, view);
        }

        if (route && request.method === "GET" && route.operation === "events") {
          const principal = await authenticator.authenticate(request);
          rejectIdentityClaim(principal, url.searchParams.get("playerId"));
          const internal = new URL("https://match.internal/events");
          internal.searchParams.set("matchId", route.matchId);
          internal.searchParams.set("playerId", principal.playerId);
          return stubFor(env, route.matchId).fetch(new Request(internal, {
            method: "GET",
            headers: request.headers,
          }));
        }

        if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
          return json(404, { error: "not_found" });
        }

        return env.ASSETS
          ? env.ASSETS.fetch(request)
          : new Response("Static assets binding is unavailable.", { status: 404 });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
