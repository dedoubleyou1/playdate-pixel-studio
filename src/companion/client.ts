import type { PreviewMode } from "../export/playdateExport";
import type { Layer, ObjectDefinition, PixelValue, ProjectPalette } from "../domain/types";
import { packPlaydateFrame, PLAYDATE_FRAME_BYTES } from "./protocol";
import {
  getDesktopStreamDevices,
  getDesktopStreamHealth,
  getDesktopStreamInfo,
  sendDesktopStreamFrame,
} from "../desktop/desktopApi";

export interface PlaydateStreamHealth {
  ok: boolean;
  service: string;
  streamPort: number;
  latestRevision: number | null;
  latestStreamId?: string | null;
  latestFrameAgeMs?: number | null;
  latestFrameBytes?: number | null;
  connectedDevices: number;
  devices?: PlaydateStreamDevice[];
}

export interface PlaydateStreamInfo {
  streamPort: number;
  hostCandidates: string[];
  latestRevision: number | null;
  latestStreamId?: string | null;
  connectedDevices: number;
  devices?: PlaydateStreamDevice[];
}

export interface PlaydateStreamDevice {
  id: string;
  address: string;
  connectedForMs: number;
  readyForMs: number | null;
  lastFrameAgeMs: number | null;
  lastRevisionSent: number | null;
  packetsSent: number;
  bytesSent: number;
}

export interface FrameSendResult {
  revision: number;
  streamId: string;
  byteLength: number;
  crc32: number;
  roundTripMs: number;
}

export async function fetchPlaydateStreamHealth(signal?: AbortSignal): Promise<PlaydateStreamHealth> {
  throwIfAborted(signal);
  const result = await getDesktopStreamHealth();
  throwIfAborted(signal);
  return result;
}

export async function fetchPlaydateStreamInfo(signal?: AbortSignal): Promise<PlaydateStreamInfo> {
  throwIfAborted(signal);
  const result = await getDesktopStreamInfo();
  throwIfAborted(signal);
  return result;
}

export async function fetchPlaydateStreamDevices(
  signal?: AbortSignal,
): Promise<{ connectedDevices: number; devices: PlaydateStreamDevice[] }> {
  throwIfAborted(signal);
  const result = await getDesktopStreamDevices();
  throwIfAborted(signal);
  return result;
}

export async function sendPlaydateStreamFrame(
  layers: Layer[],
  mode: PreviewMode,
  revision: number,
  objects: ObjectDefinition[],
  background: PixelValue,
  palette: ProjectPalette,
  streamId: string,
  signal?: AbortSignal,
): Promise<FrameSendResult> {
  const packed = packPlaydateFrame(layers, mode, revision, objects, background, palette);
  if (packed.payload.byteLength !== PLAYDATE_FRAME_BYTES) {
    throw new Error("Packed frame had an unexpected size.");
  }

  const startedAt = performance.now();
  const body = packed.payload.buffer.slice(
    packed.payload.byteOffset,
    packed.payload.byteOffset + packed.payload.byteLength,
  ) as ArrayBuffer;
  throwIfAborted(signal);
  const result = await sendDesktopStreamFrame({
    revision: packed.revision,
    streamId,
    flags: packed.flags,
    payload: body,
    crc32: packed.crc32,
  });
  throwIfAborted(signal);
  return {
    revision: result.revision,
    streamId: result.streamId ?? streamId,
    byteLength: packed.byteLength,
    crc32: packed.crc32,
    roundTripMs: Math.round(performance.now() - startedAt),
  };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
}
