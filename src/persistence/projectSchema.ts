import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import { cloneSnapshot } from "../domain/layers";
import type { EditorSnapshot, PixelLayer } from "../domain/types";

export const PROJECT_SCHEMA_VERSION = 1;

export interface SerializedLayer {
  id: number;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  data: string;
}

export interface PlaydateProjectDocument {
  schemaVersion: number;
  id: string;
  name: string;
  width: number;
  height: number;
  updatedAt: number;
  snapshot: {
    nextLayerId: number;
    activeLayerIndex: number;
    layers: SerializedLayer[];
  };
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
}

export function serializeProject(snapshot: EditorSnapshot, id: string, name: string): PlaydateProjectDocument {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id,
    name,
    width: PLAYDATE_WIDTH,
    height: PLAYDATE_HEIGHT,
    updatedAt: Date.now(),
    snapshot: {
      nextLayerId: snapshot.nextLayerId,
      activeLayerIndex: snapshot.activeLayerIndex,
      layers: snapshot.layers.map(serializeLayer),
    },
  };
}

export function deserializeProject(document: PlaydateProjectDocument): EditorSnapshot {
  if (document.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error(`Unsupported project schema version ${document.schemaVersion}.`);
  }
  if (document.width !== PLAYDATE_WIDTH || document.height !== PLAYDATE_HEIGHT) {
    throw new Error(`Unsupported project size ${document.width}x${document.height}.`);
  }

  return cloneSnapshot({
    nextLayerId: document.snapshot.nextLayerId,
    activeLayerIndex: document.snapshot.activeLayerIndex,
    layers: document.snapshot.layers.map(deserializeLayer),
  });
}

export function exportProjectJson(document: PlaydateProjectDocument): string {
  return JSON.stringify(document, null, 2);
}

export function parseProjectJson(json: string): PlaydateProjectDocument {
  const parsed = JSON.parse(json) as PlaydateProjectDocument;
  if (!parsed || typeof parsed !== "object" || parsed.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error("The selected file is not a Playdate Pixel Studio project.");
  }
  return parsed;
}

function serializeLayer(layer: PixelLayer): SerializedLayer {
  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity,
    data: uint8ToBase64(layer.data),
  };
}

function deserializeLayer(layer: SerializedLayer): PixelLayer {
  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity,
    data: base64ToUint8(layer.data),
  };
}

function uint8ToBase64(data: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < data.length; index += 1) {
    binary += String.fromCharCode(data[index]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const data = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    data[index] = binary.charCodeAt(index);
  }
  return data;
}
