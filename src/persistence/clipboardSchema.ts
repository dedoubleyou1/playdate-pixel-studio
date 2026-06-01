import {
  EDITOR_CLIPBOARD_KIND,
  EDITOR_CLIPBOARD_SCHEMA_VERSION,
  type EditorClipboard,
} from "../domain/clipboard";
import { createSurface } from "../domain/layers";
import { normalizeBinaryMaskSurface } from "../domain/masks";
import { MAX_SWATCH_REF } from "../domain/types";
import type { Point } from "../domain/types";
import {
  decodeSerializedSurfaceData,
  serializeSurface,
  type SerializedSurface,
} from "./serializedSurface";

export interface SerializedEditorClipboard {
  kind: typeof EDITOR_CLIPBOARD_KIND;
  origin: Point;
  schemaVersion: typeof EDITOR_CLIPBOARD_SCHEMA_VERSION;
  surface: SerializedSurface;
  mask: SerializedSurface;
}

export function serializeEditorClipboard(clipboard: EditorClipboard): string {
  const document: SerializedEditorClipboard = {
    kind: EDITOR_CLIPBOARD_KIND,
    origin: { ...clipboard.origin },
    schemaVersion: EDITOR_CLIPBOARD_SCHEMA_VERSION,
    surface: serializeSurface(clipboard.surface),
    mask: serializeSurface(clipboard.mask),
  };
  return JSON.stringify(document);
}

export function parseEditorClipboardJson(json: string): EditorClipboard | null {
  try {
    const parsed = JSON.parse(json) as Partial<SerializedEditorClipboard>;
    if (!isSerializedEditorClipboard(parsed)) return null;
    const surfaceData = decodeSurfaceDataWithExactLength(parsed.surface);
    const maskData = decodeSurfaceDataWithExactLength(parsed.mask);
    if (!surfaceData || !maskData) return null;
    if (surfaceData.some((pixel) => !Number.isInteger(pixel) || pixel < 0 || pixel > MAX_SWATCH_REF)) return null;
    if (maskData.some((value) => value !== 0 && value !== 1)) return null;

    return {
      kind: EDITOR_CLIPBOARD_KIND,
      origin: { x: parsed.origin.x, y: parsed.origin.y },
      schemaVersion: EDITOR_CLIPBOARD_SCHEMA_VERSION,
      surface: createSurface(parsed.surface.width, parsed.surface.height, surfaceData),
      mask: normalizeBinaryMaskSurface(parsed.mask.width, parsed.mask.height, maskData),
    };
  } catch {
    return null;
  }
}

function isSerializedEditorClipboard(value: Partial<SerializedEditorClipboard>): value is SerializedEditorClipboard {
  return (
    value.kind === EDITOR_CLIPBOARD_KIND &&
    value.schemaVersion === EDITOR_CLIPBOARD_SCHEMA_VERSION &&
    isPoint(value.origin) &&
    isSerializedSurface(value.surface) &&
    isSerializedSurface(value.mask) &&
    value.surface.width === value.mask.width &&
    value.surface.height === value.mask.height
  );
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<Point>;
  return Number.isInteger(point.x) && Number.isInteger(point.y);
}

function isSerializedSurface(value: unknown): value is SerializedSurface {
  if (!value || typeof value !== "object") return false;
  const surface = value as Partial<SerializedSurface>;
  const { data, height, width } = surface;
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    typeof width === "number" &&
    typeof height === "number" &&
    width > 0 &&
    height > 0 &&
    typeof data === "string"
  );
}

function decodeSurfaceDataWithExactLength(surface: SerializedSurface): Uint8Array | null {
  try {
    const data = decodeSerializedSurfaceData(surface);
    return data.length === surface.width * surface.height ? data : null;
  } catch {
    return null;
  }
}
