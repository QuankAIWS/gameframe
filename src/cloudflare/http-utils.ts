export interface ApiError extends Error {
  code?: string;
  revision?: number;
}

export function json(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
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
    : error.code === "forbidden" || error.code === "identity_mismatch"
      ? 403
      : error.code === "stale_revision" || error.code === "match_exists"
        ? 409
        : error.code === "match_not_found"
          ? 404
          : 400;
  return json(status, {
    error: error.code ?? "bad_request",
    message: error.message,
    revision: error.revision,
  });
}
