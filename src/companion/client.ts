import type { PreviewMode } from "../export/playdateExport";
import type { PixelLayer } from "../domain/types";
import { packPlaydateFrame, PLAYDATE_FRAME_BYTES } from "./protocol";

export const COMPANION_CONTROL_ORIGIN = "http://127.0.0.1:9137";

export interface BridgeHealth {
  ok: boolean;
  service: string;
  controlPort: number;
  streamPort: number;
  latestRevision: number | null;
  connectedDevices: number;
  devices?: BridgeDevice[];
}

export interface BridgeSession {
  sessionCode: string;
  controlPort: number;
  streamPort: number;
  hostCandidates: string[];
  latestRevision: number | null;
  connectedDevices: number;
  devices?: BridgeDevice[];
}

export interface BridgeDevice {
  id: string;
  address: string;
  connectedForMs: number;
  authenticatedForMs: number | null;
  lastFrameAgeMs: number | null;
  lastRevisionSent: number | null;
  packetsSent: number;
  bytesSent: number;
}

export interface FrameSendResult {
  revision: number;
  byteLength: number;
  crc32: number;
  roundTripMs: number;
}

export async function fetchBridgeHealth(signal?: AbortSignal): Promise<BridgeHealth> {
  return fetchBridgeJson<BridgeHealth>("/v1/health", signal);
}

export async function fetchBridgeSession(signal?: AbortSignal): Promise<BridgeSession> {
  return fetchBridgeJson<BridgeSession>("/v1/session", signal);
}

export async function fetchBridgeDevices(
  signal?: AbortSignal,
): Promise<{ connectedDevices: number; devices: BridgeDevice[] }> {
  return fetchBridgeJson<{ connectedDevices: number; devices: BridgeDevice[] }>("/v1/devices", signal);
}

export async function sendFrameToBridge(
  layers: PixelLayer[],
  mode: PreviewMode,
  revision: number,
  signal?: AbortSignal,
): Promise<FrameSendResult> {
  const packed = packPlaydateFrame(layers, mode, revision);
  if (packed.payload.byteLength !== PLAYDATE_FRAME_BYTES) {
    throw new Error("Packed frame had an unexpected size.");
  }

  const startedAt = performance.now();
  const body = packed.payload.buffer.slice(
    packed.payload.byteOffset,
    packed.payload.byteOffset + packed.payload.byteLength,
  ) as ArrayBuffer;
  const response = await fetch(`${COMPANION_CONTROL_ORIGIN}/v1/frame`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-pdps-revision": String(packed.revision),
      "x-pdps-flags": String(packed.flags),
      "x-pdps-crc32": String(packed.crc32),
    },
    body,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Bridge rejected frame (${response.status}).`);
  }

  const result = (await response.json()) as { revision: number };
  return {
    revision: result.revision,
    byteLength: packed.byteLength,
    crc32: packed.crc32,
    roundTripMs: Math.round(performance.now() - startedAt),
  };
}

async function fetchBridgeJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${COMPANION_CONTROL_ORIGIN}${path}`, { signal });
  if (!response.ok) {
    throw new Error(`Bridge request failed (${response.status}).`);
  }
  return (await response.json()) as T;
}
