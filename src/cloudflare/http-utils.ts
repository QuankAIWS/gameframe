export interface ApiError extends Error {
  code?: string;
  revision?: number;
}

export function json(status: number, value: unknown, headers: HeadersInit = {}): Response {
  const responseHeaders = new Headers(headers);
  if (!responseHeaders.has("content-type")) {
    responseHeaders.set("content-type", "application/json; charset=utf-8");
  }
  if (!responseHeaders.has("cache-control")) {
    responseHeaders.set("cache-control", "no-store");
  }
  return new Response(JSON.stringify(value), {
    status,
    headers: responseHeaders,
  });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.text();
  if (body.length > 16_384) throw new Error("Request body is too large.");
  return body ? JSON.parse(body) as Record<string, unknown> : {};
}

export function errorResponse(caught: unknown): Response {
  const error = caught as ApiError;
  const status = error.code === "authentication_required"
    ? 401
    : error.code === "forbidden"
      || error.code === "identity_mismatch"
      || error.code === "invitation_target_mismatch"
      ? 403
      : error.code === "match_not_found" || error.code === "invitation_not_found"
        ? 404
        : error.code === "invitation_expired"
          ? 410
          : error.code === "stale_revision"
            || error.code === "match_exists"
            || error.code === "invitation_claimed"
            || error.code === "invitation_cancelled"
            || error.code === "invitation_declined"
            || error.code === "invitation_conflict"
            ? 409
            : error.code === "discord_oauth_exchange_failed" || error.code === "discord_identity_failed"
              ? 502
              : error.code === "oauth_configuration_error"
                ? 503
                : 400;
  return json(status, {
    error: error.code ?? "bad_request",
    message: error.message,
    revision: error.revision,
  });
}
