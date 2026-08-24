import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import type { CascadeDiagnosticIncident } from "./cascade-diagnostics-object-runtime.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

interface InternalErrorBody {
  error?: string;
  message?: string;
}

interface DiagnosticsReadModel {
  schemaVersion: 1;
  updatedAt: number;
  retentionDays: number;
  maxStoredIncidents: number;
  incidents: CascadeDiagnosticIncident[];
}

interface DirectoryPlayer {
  playerId: string;
  displayName: string | null;
  source: string | null;
}

async function internalJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as InternalErrorBody;
  if (!response.ok) {
    throw Object.assign(new Error(body.message ?? `Internal Cascade diagnostics request failed with ${response.status}.`), {
      code: body.error ?? "cascade_diagnostics_internal_error",
    });
  }
  return body as T;
}

function playerStub(env: GameFrameWorkerEnv, playerId: string) {
  return env.MATCHES.get(env.MATCHES.idFromName(`player:${playerId}`));
}

function directoryStub(env: GameFrameWorkerEnv) {
  return env.MATCHES.get(env.MATCHES.idFromName("directory:players"));
}

function receivedBuildId(env: GameFrameWorkerEnv): string | null {
  const value = env.CF_VERSION_METADATA?.id?.trim() ?? "";
  return value || null;
}

export async function recordCascadeDiagnostics(
  env: GameFrameWorkerEnv,
  playerId: string,
  value: Record<string, unknown>,
) {
  const incidents = Array.isArray(value.incidents) ? value.incidents.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    const incident = entry as Record<string, unknown>;
    const currentPayload = incident.payload && typeof incident.payload === "object" && !Array.isArray(incident.payload)
      ? incident.payload as Record<string, unknown>
      : {};
    return {
      ...incident,
      payload: {
        ...currentPayload,
        receivedBuildId: receivedBuildId(env),
      },
    };
  }) : [];
  return internalJson<{
    accepted: number;
    duplicates: number;
    storedIncidents: number;
    retentionDays: number;
    updatedAt: number;
  }>(await playerStub(env, playerId).fetch(new Request("https://player.internal/diagnostics/cascade/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ incidents }),
  })));
}

async function readPlayerDiagnostics(env: GameFrameWorkerEnv, playerId: string): Promise<DiagnosticsReadModel> {
  return internalJson<DiagnosticsReadModel>(
    await playerStub(env, playerId).fetch(new Request("https://player.internal/diagnostics/cascade/export")),
  );
}

export async function exportCascadeDiagnostics(
  env: GameFrameWorkerEnv,
  admin: AuthenticatedPrincipal,
) {
  const url = new URL("https://player.internal/directory/list");
  url.searchParams.set("playerId", admin.playerId);
  const directory = await internalJson<{ players: DirectoryPlayer[] }>(await directoryStub(env).fetch(new Request(url)));
  const profiles: DirectoryPlayer[] = [
    {
      playerId: admin.playerId,
      displayName: admin.displayName ?? null,
      source: admin.source,
    },
    ...directory.players,
  ];
  const unique = [...new Map(profiles.map((profile) => [profile.playerId, profile])).values()];
  const players = await Promise.all(unique.map(async (profile) => {
    try {
      return { ...profile, diagnostics: await readPlayerDiagnostics(env, profile.playerId) };
    } catch {
      return {
        ...profile,
        diagnostics: {
          schemaVersion: 1 as const,
          updatedAt: 0,
          retentionDays: 30,
          maxStoredIncidents: 40,
          incidents: [] as CascadeDiagnosticIncident[],
        },
      };
    }
  }));
  const rows = players
    .map((player) => ({
      playerId: player.playerId,
      displayName: player.displayName,
      source: player.source,
      updatedAt: player.diagnostics.updatedAt || null,
      incidents: player.diagnostics.incidents,
    }))
    .filter((player) => player.incidents.length > 0);
  return {
    schemaVersion: 1,
    gameId: "cascade",
    generatedAt: new Date().toISOString(),
    retentionDays: 30,
    maxIncidentsPerPlayer: 40,
    totals: {
      playersWithIncidents: rows.length,
      incidents: rows.reduce((sum, player) => sum + player.incidents.length, 0),
    },
    players: rows,
  };
}
