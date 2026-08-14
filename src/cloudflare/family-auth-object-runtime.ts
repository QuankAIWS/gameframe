import { errorResponse, json, readJson } from "./http-utils.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

const PENDING_KEY = "gameframe:family-auth:pending:v1";
const DEVICES_KEY = "gameframe:family-auth:devices:v1";

export interface FamilyEnrollmentRecord {
  requestId: string;
  claimHash: string;
  playerId: string;
  displayName: string | null;
  deviceLabel: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  approvedAt: number | null;
  approvedBy: string | null;
  consumedAt: number | null;
}

export interface TrustedDeviceRecord {
  deviceId: string;
  secretHash: string;
  playerId: string;
  displayName: string | null;
  deviceLabel: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  revokedAt: number | null;
  approvedBy: string;
}

interface PendingStore { version: 1; requests: FamilyEnrollmentRecord[] }
interface DeviceStore { version: 1; devices: TrustedDeviceRecord[] }

function text(value: unknown, maximum: number): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maximum) throw Object.assign(new Error("Family authentication input is invalid."), { code: "family_auth_invalid", status: 400 });
  return normalized;
}

function optionalText(value: unknown, maximum: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  return text(value, maximum);
}

function number(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw Object.assign(new Error("Family authentication timestamp is invalid."), { code: "family_auth_invalid", status: 400 });
  return Math.floor(parsed);
}

export class FamilyAuthObjectRuntime {
  readonly #storage: DurableStorageLike;
  #tail: Promise<void> = Promise.resolve();

  constructor(storage: DurableStorageLike) {
    this.#storage = storage;
  }

  fetch(request: Request): Promise<Response> {
    const execute = async () => this.#handle(request);
    const result = this.#tail.then(execute, execute);
    this.#tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async #pending(): Promise<PendingStore> {
    return await this.#storage.get<PendingStore>(PENDING_KEY) ?? { version: 1, requests: [] };
  }

  async #devices(): Promise<DeviceStore> {
    return await this.#storage.get<DeviceStore>(DEVICES_KEY) ?? { version: 1, devices: [] };
  }

  async #handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/family/enroll") return json(200, await this.#enroll(await readJson(request)));
      if (request.method === "GET" && url.pathname === "/family/enrollments") return json(200, await this.#listEnrollments());
      if (request.method === "POST" && url.pathname === "/family/approve") return json(200, await this.#approve(await readJson(request)));
      if (request.method === "POST" && url.pathname === "/family/claim") return json(200, await this.#claim(await readJson(request)));
      if (request.method === "POST" && url.pathname === "/family/device/issue") return json(200, await this.#issueDevice(await readJson(request)));
      if (request.method === "POST" && url.pathname === "/family/device/verify") return json(200, await this.#verifyDevice(await readJson(request)));
      if (request.method === "GET" && url.pathname === "/family/devices") return json(200, await this.#listDevices());
      if (request.method === "POST" && url.pathname === "/family/device/revoke") return json(200, await this.#revokeDevice(await readJson(request)));
      return json(404, { error: "not_found" });
    } catch (error) {
      return errorResponse(error);
    }
  }

  async #enroll(body: Record<string, unknown>) {
    const now = Date.now();
    const record: FamilyEnrollmentRecord = {
      requestId: text(body.requestId, 120),
      claimHash: text(body.claimHash, 128),
      playerId: text(body.playerId, 160),
      displayName: optionalText(body.displayName, 100),
      deviceLabel: text(body.deviceLabel, 100),
      code: text(body.code, 12),
      createdAt: number(body.createdAt),
      expiresAt: number(body.expiresAt),
      approvedAt: null,
      approvedBy: null,
      consumedAt: null,
    };
    const store = await this.#pending();
    const requests = [record, ...store.requests.filter((item) => item.requestId !== record.requestId && item.expiresAt > now - 86_400_000)].slice(0, 100);
    await this.#storage.put(PENDING_KEY, { version: 1, requests });
    return { requestId: record.requestId };
  }

  async #listEnrollments() {
    const now = Date.now();
    const store = await this.#pending();
    return {
      requests: store.requests.filter((item) => item.expiresAt > now && !item.consumedAt).map(({ claimHash: _claimHash, ...item }) => item),
    };
  }

  async #approve(body: Record<string, unknown>) {
    const requestId = text(body.requestId, 120);
    const approvedBy = text(body.approvedBy, 160);
    const now = Date.now();
    const store = await this.#pending();
    const existing = store.requests.find((item) => item.requestId === requestId);
    if (!existing || existing.expiresAt <= now || existing.consumedAt) throw Object.assign(new Error("Enrollment request is expired or unavailable."), { code: "family_enrollment_unavailable", status: 404 });
    existing.approvedAt = now;
    existing.approvedBy = approvedBy;
    await this.#storage.put(PENDING_KEY, store);
    return { approved: true, requestId };
  }

  async #claim(body: Record<string, unknown>) {
    const requestId = text(body.requestId, 120);
    const claimHash = text(body.claimHash, 128);
    const now = Date.now();
    const store = await this.#pending();
    const existing = store.requests.find((item) => item.requestId === requestId);
    if (!existing || existing.expiresAt <= now || existing.consumedAt || existing.claimHash !== claimHash) return { status: "unavailable" };
    if (!existing.approvedAt || !existing.approvedBy) return { status: "pending", expiresAt: existing.expiresAt };
    existing.consumedAt = now;
    await this.#storage.put(PENDING_KEY, store);
    return {
      status: "approved",
      playerId: existing.playerId,
      displayName: existing.displayName,
      deviceLabel: existing.deviceLabel,
      approvedBy: existing.approvedBy,
    };
  }

  async #issueDevice(body: Record<string, unknown>) {
    const record: TrustedDeviceRecord = {
      deviceId: text(body.deviceId, 120),
      secretHash: text(body.secretHash, 128),
      playerId: text(body.playerId, 160),
      displayName: optionalText(body.displayName, 100),
      deviceLabel: text(body.deviceLabel, 100),
      createdAt: number(body.createdAt),
      lastUsedAt: number(body.lastUsedAt),
      expiresAt: number(body.expiresAt),
      revokedAt: null,
      approvedBy: text(body.approvedBy, 160),
    };
    const store = await this.#devices();
    const devices = [record, ...store.devices.filter((item) => item.deviceId !== record.deviceId)].slice(0, 100);
    await this.#storage.put(DEVICES_KEY, { version: 1, devices });
    return { deviceId: record.deviceId };
  }

  async #verifyDevice(body: Record<string, unknown>) {
    const deviceId = text(body.deviceId, 120);
    const secretHash = text(body.secretHash, 128);
    const now = Date.now();
    const store = await this.#devices();
    const device = store.devices.find((item) => item.deviceId === deviceId);
    if (!device || device.revokedAt || device.expiresAt <= now || device.secretHash !== secretHash) return { authenticated: false };
    device.lastUsedAt = now;
    const rollingExpiry = now + 180 * 24 * 60 * 60 * 1000;
    device.expiresAt = Math.max(device.expiresAt, rollingExpiry);
    await this.#storage.put(DEVICES_KEY, store);
    return {
      authenticated: true,
      deviceId: device.deviceId,
      playerId: device.playerId,
      displayName: device.displayName,
      deviceLabel: device.deviceLabel,
      expiresAt: device.expiresAt,
    };
  }

  async #listDevices() {
    const store = await this.#devices();
    return { devices: store.devices.map(({ secretHash: _secretHash, ...device }) => device) };
  }

  async #revokeDevice(body: Record<string, unknown>) {
    const deviceId = text(body.deviceId, 120);
    const store = await this.#devices();
    const device = store.devices.find((item) => item.deviceId === deviceId);
    if (!device) throw Object.assign(new Error("Trusted device was not found."), { code: "trusted_device_not_found", status: 404 });
    device.revokedAt = Date.now();
    await this.#storage.put(DEVICES_KEY, store);
    return { revoked: true, deviceId };
  }
}
