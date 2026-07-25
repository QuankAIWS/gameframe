export interface DurableStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export interface DurableObjectContextLike {
  storage: DurableStorageLike;
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
  MATCHES: DurableObjectNamespaceLike;
  ASSETS?: AssetFetcherLike;
}
