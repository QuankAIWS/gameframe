export type PrincipalSource = "development" | "discord" | "service";

export interface AuthenticatedPrincipal {
  playerId: string;
  source: PrincipalSource;
}

export interface RequestAuthenticator {
  authenticate(request: Request): Promise<AuthenticatedPrincipal>;
}

export class AuthenticationError extends Error {
  readonly code: "authentication_required" | "identity_mismatch" | "forbidden";

  constructor(
    code: AuthenticationError["code"],
    message: string,
  ) {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
  }
}

export class RejectingRequestAuthenticator implements RequestAuthenticator {
  readonly #message: string;

  constructor(message = "No production identity verifier is configured.") {
    this.#message = message;
  }

  async authenticate(_request: Request): Promise<AuthenticatedPrincipal> {
    throw new AuthenticationError("authentication_required", this.#message);
  }
}

export class DevelopmentHeaderAuthenticator implements RequestAuthenticator {
  readonly #headerName: string;

  constructor(headerName = "x-gameframe-player-id") {
    this.#headerName = headerName;
  }

  async authenticate(request: Request): Promise<AuthenticatedPrincipal> {
    const playerId = request.headers.get(this.#headerName)?.trim() ?? "";
    if (!playerId) {
      throw new AuthenticationError(
        "authentication_required",
        `Development requests require the ${this.#headerName} header.`,
      );
    }
    return { playerId, source: "development" };
  }
}

export function requirePrincipalSeat(
  principal: AuthenticatedPrincipal,
  playerIds: readonly string[],
): void {
  if (!playerIds.includes(principal.playerId)) {
    throw new AuthenticationError(
      "forbidden",
      "The authenticated principal must occupy one of the requested match seats.",
    );
  }
}

export function rejectIdentityClaim(
  principal: AuthenticatedPrincipal,
  claimedPlayerId: unknown,
): void {
  if (claimedPlayerId === undefined || claimedPlayerId === null || claimedPlayerId === "") {
    return;
  }
  if (String(claimedPlayerId) !== principal.playerId) {
    throw new AuthenticationError(
      "identity_mismatch",
      "The request attempted to act as a different player identity.",
    );
  }
}
