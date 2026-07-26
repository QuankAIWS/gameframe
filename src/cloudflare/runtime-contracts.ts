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

export interface GameFrameWorkerEnv {
  SESSION_SECRET?: string;
  MATCHES: DurableObjectNamespaceLike;
  ASSETS?: AssetFetcherLike;
}
