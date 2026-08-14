import {
  SignedCookieSessionAuthenticator,
  SignedSessionCodec,
  clearWebsiteSessionCookie,
  createWebsiteSessionCookie,
  readCookie,
} from "../auth/signed-session.ts";
import { requireStagingAdminPrincipal } from "../auth/staging-admin.ts";
import { errorResponse, json, readJson } from "./http-utils.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const DEVICE_TTL_SECONDS = 180 * 24 * 60 * 60;
const ENROLLMENT_TTL_MS = 10 * 60 * 1000;
const TRUSTED_COOKIE = "gameframe_trusted_device";
const encoder = new TextEncoder();

interface FamilyAccountConfig { email: string; playerId: string; displayName?: string }

function authStub(env: GameFrameWorkerEnv) {
  return env.MATCHES.get(env.MATCHES.idFromName("family-auth:v1"));
}

function normalizeEmail(value: unknown): string {
  const email = String(value ?? "").trim().toLowerCase();
  return email.length >= 3 && email.length <= 254 && email.includes("@") ? email : "";
}

function label(value: unknown): string {
  const normalized = String(value ?? "This device").trim().slice(0, 100);
  return normalized || "This device";
}

function familyAccounts(env: GameFrameWorkerEnv): FamilyAccountConfig[] {
  try {
    const parsed = JSON.parse(env.GAMEFRAME_FAMILY_ACCOUNTS ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const email = normalizeEmail(item?.email);
      const playerId = String(item?.playerId ?? "").trim();
      if (!email || !playerId || playerId.length > 160) return [];
      const displayName = String(item?.displayName ?? "").trim().slice(0, 100);
      return [{ email, playerId, ...(displayName ? { displayName } : {}) }];
    });
  } catch {
    return [];
  }
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32): string {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function enrollmentCode(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(value).padStart(6, "0");
}

function trustedCookie(value: string, maxAgeSeconds = DEVICE_TTL_SECONDS): string {
  return `${TRUSTED_COOKIE}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

function clearTrustedCookie(): string {
  return `${TRUSTED_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

async function configuredAccount(env: GameFrameWorkerEnv, email: string): Promise<FamilyAccountConfig | null> {
  const pepper = env.GAMEFRAME_FAMILY_AUTH_PEPPER?.trim() ?? "";
  if (pepper.length < 32) return null;
  const candidate = await hmacHex(pepper, email);
  for (const account of familyAccounts(env)) {
    if (await hmacHex(pepper, account.email) === candidate) return account;
  }
  return null;
}

async function internal(env: GameFrameWorkerEnv, path: string, init: RequestInit = {}) {
  return authStub(env).fetch(new Request(`https://family.internal${path}`, init));
}

async function body(response: Response): Promise<Record<string, any>> {
  return await response.json().catch(() => ({})) as Record<string, any>;
}

async function requireAdmin(request: Request, env: GameFrameWorkerEnv) {
  const secret = env.SESSION_SECRET?.trim() ?? "";
  if (secret.length < 32) throw Object.assign(new Error("Family authentication requires SESSION_SECRET."), { code: "family_auth_unconfigured", status: 503 });
  const principal = await new SignedCookieSessionAuthenticator(new SignedSessionCodec(secret)).authenticate(request);
  return requireStagingAdminPrincipal(env, principal);
}

async function requireApprovalSecret(request: Request, env: GameFrameWorkerEnv) {
  const configured = env.GAMEFRAME_FAMILY_APPROVAL_SECRET?.trim() ?? "";
  const supplied = request.headers.get("x-gameframe-family-approval")?.trim() ?? "";
  if (configured.length < 32 || supplied.length < 32 || await sha256Hex(configured) !== await sha256Hex(supplied)) {
    throw Object.assign(new Error("Family device approval requires the separate approval credential."), { code: "family_approval_required", status: 403 });
  }
}

async function issueSession(env: GameFrameWorkerEnv, playerId: string, displayName: string | null) {
  const secret = env.SESSION_SECRET?.trim() ?? "";
  const codec = new SignedSessionCodec(secret);
  const token = await codec.issue({ playerId, source: "discord", ...(displayName ? { displayName } : {}) }, SESSION_TTL_SECONDS);
  return createWebsiteSessionCookie(token, { maxAgeSeconds: SESSION_TTL_SECONDS });
}

async function startEnrollment(request: Request, env: GameFrameWorkerEnv) {
  const input = await readJson(request);
  const email = normalizeEmail(input.email);
  const account = email ? await configuredAccount(env, email) : null;
  const requestId = crypto.randomUUID();
  const claimToken = randomToken();
  const code = enrollmentCode();
  const expiresAt = Date.now() + ENROLLMENT_TTL_MS;
  if (account) {
    await internal(env, "/family/enroll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId,
        claimHash: await sha256Hex(claimToken),
        playerId: account.playerId,
        displayName: account.displayName ?? null,
        deviceLabel: label(input.deviceLabel),
        code,
        createdAt: Date.now(),
        expiresAt,
      }),
    });
  }
  // Unknown emails receive the same outward shape. They simply never become
  // approvable, avoiding an account-enumeration oracle.
  return json(202, { requestId, claimToken, code, expiresAt });
}

async function claimEnrollment(request: Request, env: GameFrameWorkerEnv) {
  const input = await readJson(request);
  const result = await body(await internal(env, "/family/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId: input.requestId, claimHash: await sha256Hex(String(input.claimToken ?? "")) }),
  }));
  if (result.status !== "approved") return json(200, { status: result.status === "unavailable" ? "pending" : result.status, expiresAt: result.expiresAt ?? null });

  const deviceId = crypto.randomUUID();
  const deviceSecret = randomToken();
  const now = Date.now();
  await internal(env, "/family/device/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      deviceId,
      secretHash: await sha256Hex(deviceSecret),
      playerId: result.playerId,
      displayName: result.displayName ?? null,
      deviceLabel: result.deviceLabel,
      createdAt: now,
      lastUsedAt: now,
      expiresAt: now + DEVICE_TTL_SECONDS * 1000,
      approvedBy: result.approvedBy,
    }),
  });
  const response = json(200, { status: "approved", playerId: result.playerId, displayName: result.displayName ?? null });
  response.headers.append("Set-Cookie", trustedCookie(`${deviceId}.${deviceSecret}`));
  response.headers.append("Set-Cookie", await issueSession(env, result.playerId, result.displayName ?? null));
  return response;
}

async function refreshTrusted(request: Request, env: GameFrameWorkerEnv) {
  const token = readCookie(request, TRUSTED_COOKIE) ?? "";
  const separator = token.indexOf(".");
  if (separator <= 0) return json(401, { error: "trusted_device_required" });
  const deviceId = token.slice(0, separator);
  const deviceSecret = token.slice(separator + 1);
  const result = await body(await internal(env, "/family/device/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId, secretHash: await sha256Hex(deviceSecret) }),
  }));
  if (!result.authenticated) {
    const response = json(401, { error: "trusted_device_invalid" });
    response.headers.append("Set-Cookie", clearTrustedCookie());
    response.headers.append("Set-Cookie", clearWebsiteSessionCookie());
    return response;
  }
  const response = json(200, { authenticated: true, playerId: result.playerId });
  response.headers.append("Set-Cookie", await issueSession(env, result.playerId, result.displayName ?? null));
  response.headers.append("Set-Cookie", trustedCookie(token));
  return response;
}

async function logoutTrusted(request: Request, env: GameFrameWorkerEnv) {
  const token = readCookie(request, TRUSTED_COOKIE) ?? "";
  const separator = token.indexOf(".");
  if (separator > 0) {
    const deviceId = token.slice(0, separator);
    // Possession of the HttpOnly device cookie is sufficient to revoke that same
    // device. The caller cannot choose another device ID through this route.
    await internal(env, "/family/device/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId }),
    }).catch(() => null);
  }
  const response = json(200, { authenticated: false, trustedDeviceRevoked: separator > 0 });
  response.headers.append("Set-Cookie", clearTrustedCookie());
  response.headers.append("Set-Cookie", clearWebsiteSessionCookie());
  return response;
}

async function adminEnrollments(request: Request, env: GameFrameWorkerEnv) {
  await requireAdmin(request, env);
  return internal(env, "/family/enrollments");
}

async function approveEnrollment(request: Request, env: GameFrameWorkerEnv) {
  const admin = await requireAdmin(request, env);
  await requireApprovalSecret(request, env);
  const input = await readJson(request);
  return internal(env, "/family/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId: input.requestId, approvedBy: admin.playerId }),
  });
}

async function adminDevices(request: Request, env: GameFrameWorkerEnv) {
  await requireAdmin(request, env);
  return internal(env, "/family/devices");
}

async function revokeDevice(request: Request, env: GameFrameWorkerEnv) {
  await requireAdmin(request, env);
  const input = await readJson(request);
  return internal(env, "/family/device/revoke", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: input.deviceId }),
  });
}

export function familyAuthEdgeRoute(pathname: string): boolean {
  return pathname.startsWith("/auth/family/") || pathname.startsWith("/auth/trusted-device/") || pathname.startsWith("/api/admin/family/");
}

export async function handleFamilyAuthEdge(request: Request, env: GameFrameWorkerEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/auth/family/enroll/start") return startEnrollment(request, env);
    if (request.method === "POST" && url.pathname === "/auth/family/enroll/claim") return claimEnrollment(request, env);
    if (request.method === "POST" && url.pathname === "/auth/trusted-device/refresh") return refreshTrusted(request, env);
    if (request.method === "POST" && url.pathname === "/auth/trusted-device/logout") return logoutTrusted(request, env);
    if (request.method === "GET" && url.pathname === "/api/admin/family/enrollments") return adminEnrollments(request, env);
    if (request.method === "POST" && url.pathname === "/api/admin/family/enrollments/approve") return approveEnrollment(request, env);
    if (request.method === "GET" && url.pathname === "/api/admin/family/devices") return adminDevices(request, env);
    if (request.method === "POST" && url.pathname === "/api/admin/family/devices/revoke") return revokeDevice(request, env);
    return json(404, { error: "not_found" });
  } catch (error) {
    return errorResponse(error);
  }
}