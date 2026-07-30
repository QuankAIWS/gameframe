export interface DiscordActivityConfiguration {
  clientId: string;
  state: string;
  scopes: string[];
}

export interface DiscordActivityAuthorization {
  code: string;
}

export interface DiscordActivityAuthentication {
  user?: {
    id?: string;
    username?: string;
    global_name?: string | null;
  };
}

export interface DiscordActivitySdkLike {
  ready(): Promise<void>;
  commands: {
    authorize(input: {
      client_id: string;
      response_type: "code";
      state: string;
      prompt: "none";
      scope: string[];
    }): Promise<DiscordActivityAuthorization>;
    authenticate(input: { access_token: string }): Promise<DiscordActivityAuthentication>;
  };
}

export interface DiscordActivitySessionResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  session: {
    authenticated: true;
    playerId: string;
    source: "discord";
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface DiscordActivityClientDependencies {
  createSdk: (clientId: string) => DiscordActivitySdkLike;
  fetcher?: typeof fetch;
}

export function isDiscordActivityHost(hostname: string): boolean {
  return /^\d+\.discordsays\.com$/i.test(hostname);
}

async function jsonOrThrow<T>(response: Response, context: string): Promise<T> {
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof body.message === "string"
        ? body.message
        : `${context} failed with HTTP ${response.status}.`,
    );
  }
  return body as T;
}

function validConfiguration(value: DiscordActivityConfiguration): void {
  if (!/^\d+$/.test(value.clientId)) throw new Error("The Activity server returned an invalid Discord client ID.");
  if (!value.state || value.state.length > 4096) throw new Error("The Activity server returned an invalid OAuth state.");
  if (!Array.isArray(value.scopes) || !value.scopes.includes("identify")) {
    throw new Error("The Activity server did not request the required identify scope.");
  }
}

function validSession(value: DiscordActivitySessionResponse): void {
  if (
    !value.access_token ||
    value.token_type.toLowerCase() !== "bearer" ||
    !Number.isFinite(value.expires_in) ||
    value.expires_in <= 0 ||
    value.session?.authenticated !== true ||
    value.session.source !== "discord" ||
    !/^discord:\d+$/.test(value.session.playerId)
  ) {
    throw new Error("The Activity server returned an invalid authenticated session.");
  }
}

export async function establishDiscordActivitySession(
  dependencies: DiscordActivityClientDependencies,
): Promise<DiscordActivitySessionResponse["session"]> {
  const fetcher = dependencies.fetcher ?? fetch;
  const configuration = await jsonOrThrow<DiscordActivityConfiguration>(
    await fetcher("/auth/discord/activity/config", {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    }),
    "Discord Activity configuration",
  );
  validConfiguration(configuration);

  const sdk = dependencies.createSdk(configuration.clientId);
  await sdk.ready();
  const authorization = await sdk.commands.authorize({
    client_id: configuration.clientId,
    response_type: "code",
    state: configuration.state,
    prompt: "none",
    scope: [...configuration.scopes],
  });
  if (!authorization.code || authorization.code.length > 2048) {
    throw new Error("Discord did not return a valid Activity authorization code.");
  }

  const exchange = await jsonOrThrow<DiscordActivitySessionResponse>(
    await fetcher("/auth/discord/activity/session", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        code: authorization.code,
        state: configuration.state,
      }),
    }),
    "Discord Activity session exchange",
  );
  validSession(exchange);

  const authentication = await sdk.commands.authenticate({
    access_token: exchange.access_token,
  });
  const discordUserId = authentication.user?.id;
  if (!discordUserId || exchange.session.playerId !== `discord:${discordUserId}`) {
    throw new Error("The Discord SDK identity did not match the GameFrame session identity.");
  }

  return exchange.session;
}
