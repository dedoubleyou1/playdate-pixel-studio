import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import { TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import { cloneSnapshot, createLayer, createRootStack, createSurface } from "../domain/layers";
import type {
  EditContext,
  EditorSnapshot,
  Layer,
  LayerStack,
  ObjectDefinition,
  ObjectInstanceLayer,
  PixelLayer,
  PixelSurface,
  PixelValue,
} from "../domain/types";

export const PROJECT_SCHEMA_VERSION = 4;

export interface SerializedSurface {
  width: number;
  height: number;
  data: string;
}

export interface SerializedBaseLayer {
  id: number;
  name: string;
  visible: boolean;
  pixelEditable?: boolean;
  opacity: number;
}

export interface SerializedPixelLayer extends SerializedBaseLayer {
  type: "pixel";
  surface: SerializedSurface;
}

export interface SerializedObjectInstanceLayer extends SerializedBaseLayer {
  type: "object";
  objectId: string;
  x: number;
  y: number;
}

export type SerializedLayer = SerializedPixelLayer | SerializedObjectInstanceLayer;

export interface SerializedLayerStack {
  width: number;
  height: number;
  background?: PixelValue;
  nextLayerId: number;
  activeLayerIndex: number;
  layers: SerializedLayer[];
}

export interface SerializedObjectDefinition extends SerializedLayerStack {
  id: string;
  name: string;
  layers: SerializedPixelLayer[];
}

export interface PlaydateProjectDocument {
  schemaVersion: 4;
  id: string;
  name: string;
  width: number;
  height: number;
  updatedAt: number;
  snapshot: {
    root: SerializedLayerStack;
    objects: SerializedObjectDefinition[];
    activeContext: EditContext;
  };
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
}

interface LegacyProjectDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  width: number;
  height: number;
  updatedAt: number;
  snapshot: {
    nextLayerId: number;
    activeLayerIndex: number;
    layers: Array<{
      id: number;
      name: string;
      visible: boolean;
      locked: boolean;
      opacity: number;
      data: string;
    }>;
  };
}

interface Version2ProjectDocument extends Omit<PlaydateProjectDocument, "schemaVersion"> {
  schemaVersion: 2 | 3;
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
      root: serializeLayerStack(snapshot.root),
      objects: snapshot.objects.map(serializeObjectDefinition),
      activeContext: cloneEditContext(snapshot.activeContext),
    },
  };
}

export function deserializeProject(
  document: PlaydateProjectDocument | Version2ProjectDocument | LegacyProjectDocument,
): EditorSnapshot {
  if (document.schemaVersion === 1) {
    return deserializeLegacyProject(document);
  }

  if (document.width !== PLAYDATE_WIDTH || document.height !== PLAYDATE_HEIGHT) {
    throw new Error(`Unsupported project size ${document.width}x${document.height}.`);
  }

  return cloneSnapshot({
    root: deserializeLayerStack(document.snapshot.root),
    objects: document.snapshot.objects.map(deserializeObjectDefinition),
    activeContext: cloneEditContext(document.snapshot.activeContext),
  });
}

export function exportProjectJson(document: PlaydateProjectDocument): string {
  return JSON.stringify(document, null, 2);
}

export function parseProjectJson(
  json: string,
): PlaydateProjectDocument | Version2ProjectDocument | LegacyProjectDocument {
  const parsed = JSON.parse(json) as PlaydateProjectDocument | Version2ProjectDocument | LegacyProjectDocument;
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed.schemaVersion !== PROJECT_SCHEMA_VERSION &&
      parsed.schemaVersion !== 3 &&
      parsed.schemaVersion !== 2 &&
      parsed.schemaVersion !== 1)
  ) {
    throw new Error("The selected file is not a Playdate Pixel Studio project.");
  }
  return parsed;
}

function serializeObjectDefinition(object: ObjectDefinition): SerializedObjectDefinition {
  return {
    id: object.id,
    name: object.name,
    ...serializeLayerStack(object),
    layers: object.layers.map(serializePixelLayer),
  };
}

function deserializeObjectDefinition(object: SerializedObjectDefinition): ObjectDefinition {
  return {
    id: object.id,
    name: object.name,
    width: object.width,
    height: object.height,
    background: object.background ?? TRANSPARENT_PIXEL,
    nextLayerId: object.nextLayerId,
    activeLayerIndex: object.activeLayerIndex,
    layers: object.layers.map(deserializePixelLayer),
  };
}

function serializeLayerStack(stack: LayerStack): SerializedLayerStack {
  return {
    width: stack.width,
    height: stack.height,
    background: stack.background,
    nextLayerId: stack.nextLayerId,
    activeLayerIndex: stack.activeLayerIndex,
    layers: stack.layers.map(serializeLayer),
  };
}

function deserializeLayerStack(stack: SerializedLayerStack): LayerStack {
  return {
    width: stack.width,
    height: stack.height,
    background: stack.background ?? WHITE_PIXEL,
    nextLayerId: stack.nextLayerId,
    activeLayerIndex: stack.activeLayerIndex,
    layers: stack.layers.map(deserializeLayer),
  };
}

function serializeLayer(layer: Layer): SerializedLayer {
  if (layer.type === "object") return serializeObjectInstanceLayer(layer);
  return serializePixelLayer(layer);
}

function deserializeLayer(layer: SerializedLayer): Layer {
  if (layer.type === "object") return deserializeObjectInstanceLayer(layer);
  return deserializePixelLayer(layer);
}

function serializePixelLayer(layer: PixelLayer): SerializedPixelLayer {
  return {
    type: "pixel",
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    pixelEditable: layer.pixelEditable,
    opacity: layer.opacity,
    surface: serializeSurface(layer.surface),
  };
}

function deserializePixelLayer(layer: SerializedPixelLayer): PixelLayer {
  return {
    type: "pixel",
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    pixelEditable: layer.pixelEditable ?? true,
    opacity: layer.opacity,
    surface: deserializeSurface(layer.surface),
  };
}

function serializeObjectInstanceLayer(layer: ObjectInstanceLayer): SerializedObjectInstanceLayer {
  return {
    type: "object",
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    pixelEditable: layer.pixelEditable,
    opacity: layer.opacity,
    objectId: layer.objectId,
    x: layer.x,
    y: layer.y,
  };
}

function deserializeObjectInstanceLayer(layer: SerializedObjectInstanceLayer): ObjectInstanceLayer {
  return {
    type: "object",
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    pixelEditable: layer.pixelEditable ?? false,
    opacity: layer.opacity,
    objectId: layer.objectId,
    x: layer.x,
    y: layer.y,
  };
}

function serializeSurface(surface: PixelSurface): SerializedSurface {
  return {
    width: surface.width,
    height: surface.height,
    data: uint8ToBase64(surface.data),
  };
}

function deserializeSurface(surface: SerializedSurface): PixelSurface {
  return createSurface(surface.width, surface.height, base64ToUint8(surface.data));
}

function deserializeLegacyProject(document: LegacyProjectDocument): EditorSnapshot {
  if (document.width !== PLAYDATE_WIDTH || document.height !== PLAYDATE_HEIGHT) {
    throw new Error(`Unsupported project size ${document.width}x${document.height}.`);
  }

  const root = createRootStack();
  root.nextLayerId = document.snapshot.nextLayerId;
  root.activeLayerIndex = document.snapshot.activeLayerIndex;
  root.layers = document.snapshot.layers.map((layer) => {
    const nextLayer = createLayer(layer.id, layer.name, PLAYDATE_WIDTH, PLAYDATE_HEIGHT);
    nextLayer.visible = layer.visible;
    nextLayer.opacity = layer.opacity;
    nextLayer.surface = createSurface(PLAYDATE_WIDTH, PLAYDATE_HEIGHT, base64ToUint8(layer.data));
    return nextLayer;
  });

  return { root, objects: [], activeContext: { type: "root" } };
}

function cloneEditContext(context: EditContext): EditContext {
  return context.type === "root" ? { type: "root" } : { type: "object", objectId: context.objectId };
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
