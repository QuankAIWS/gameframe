export interface DurableStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export interface HibernationWebSocketLike {
  send(message: string | ArrayBuffer): void;
  close?(code?: number, reason?: string): void;
  serializeAttachment?(attachment: unknown): void;
  deserializeAttachment?<T>(): T | null;
  readyState?: number;
}

export interface DurableObjectContextLike {
  storage: DurableStorageLike;
  acceptWebSocket(socket: HibernationWebSocketLike, tags?: string[]): void;
  getWebSockets(tag?: string): HibernationWebSocketLike[];
}

export interface DurableObjectStubLike {
  fetch(request: Request): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

export interface AssetFetcherLike {
  fetch(request: Request): Promise<Response>;
}

export interface WorkerVersionMetadataLike {
  id: string;
  tag?: string;
  timestamp?: string;
}

export interface GameFrameWorkerEnv {
  SESSION_SECRET?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  DISCORD_ALLOWED_USER_IDS?: string;
  GAMEFRAME_ADMIN_DISCORD_USER_IDS?: string;
  GAMEFRAME_FAMILY_ACCOUNTS?: string;
  GAMEFRAME_FAMILY_AUTH_PEPPER?: string;
  GAMEFRAME_FAMILY_APPROVAL_SECRET?: string;
  GAMEFRAME_RPG_ORIGIN_URL?: string;
  GAMEFRAME_RPG_PROXY_HMAC_SECRET?: string;
  CF_VERSION_METADATA?: WorkerVersionMetadataLike;
  MATCHES: DurableObjectNamespaceLike;
  ASSETS?: AssetFetcherLike;
}