import { createSurface } from "../domain/layers";
import { normalizeBinaryMaskSurface } from "../domain/masks";
import type { BinaryMaskSurface, PixelSurface } from "../domain/types";

export interface SerializedSurface {
  width: number;
  height: number;
  data: string;
}

export function serializeSurface(surface: PixelSurface | BinaryMaskSurface): SerializedSurface {
  return {
    width: surface.width,
    height: surface.height,
    data: uint8ToBase64(surface.data),
  };
}

export function deserializePixelSurface(surface: SerializedSurface): PixelSurface {
  return createSurface(surface.width, surface.height, base64ToUint8(surface.data));
}

export function deserializeBinaryMaskSurface(surface: SerializedSurface): BinaryMaskSurface {
  return normalizeBinaryMaskSurface(surface.width, surface.height, base64ToUint8(surface.data));
}

export function decodeSerializedSurfaceData(surface: SerializedSurface): Uint8Array {
  return base64ToUint8(surface.data);
}

function uint8ToBase64(data: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let index = 0; index < data.length; index += chunkSize) {
    chunks.push(String.fromCharCode(...data.subarray(index, index + chunkSize)));
  }
  return btoa(chunks.join(""));
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const data = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    data[index] = binary.charCodeAt(index);
  }
  return data;
}
