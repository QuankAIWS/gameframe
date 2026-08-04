export type PrincipalSource = "development" | "discord" | "service";

export interface AuthenticatedPrincipal {
  playerId: string;
  source: PrincipalSource;
  displayName?: string;
  avatarUrl?: string;
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
  readonly #playerHeaderName: string;
  readonly #serviceHeaderName: string;

  constructor(
    playerHeaderName = "x-gameframe-player-id",
    serviceHeaderName = "x-gameframe-service-id",
  ) {
    this.#playerHeaderName = playerHeaderName;
    this.#serviceHeaderName = serviceHeaderName;
  }

  async authenticate(request: Request): Promise<AuthenticatedPrincipal> {
    const playerId = request.headers.get(this.#playerHeaderName)?.trim() ?? "";
    const serviceId = request.headers.get(this.#serviceHeaderName)?.trim() ?? "";
    if (playerId && serviceId) {
      throw new AuthenticationError(
        "identity_mismatch",
        "Development requests cannot claim both player and service identities.",
      );
    }
    if (serviceId) {
      return {
        playerId: serviceId,
        source: "service",
        displayName: "Development RPG service",
      };
    }
    if (!playerId) {
      throw new AuthenticationError(
        "authentication_required",
        `Development requests require the ${this.#playerHeaderName} or ${this.#serviceHeaderName} header.`,
      );
    }
    return { playerId, source: "development", displayName: "Development player" };
  }
}

export function requirePlayerPrincipal(principal: AuthenticatedPrincipal): void {
  if (principal.source === "service") {
    throw new AuthenticationError(
      "forbidden",
      "Service principals cannot use player match routes.",
    );
  }
}

export function requirePrincipalSeat(
  principal: AuthenticatedPrincipal,
  playerIds: readonly string[],
): void {
  requirePlayerPrincipal(principal);
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
