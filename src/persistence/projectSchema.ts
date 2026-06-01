import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import { TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import { clampLayerIndex, cloneSnapshot } from "../domain/layers";
import { DEFAULT_PATTERN_SAMPLING, builtInPattern } from "../domain/patterns";
import { normalizedPatternEntry, nextDuplicatePatternPreviewHue, nextPatternPaletteIndex, nextPatternPreviewHue } from "../domain/palette";
import type {
  EditContext,
  EditorSnapshot,
  Layer,
  LayerStack,
  ObjectDefinition,
  ObjectInstanceLayer,
  PaletteEntry,
  PaletteIndex,
  PatternPaletteEntry,
  PatternRotation,
  PixelLayer,
  PixelValue,
  ProjectPalette,
  SolidPaletteEntry,
} from "../domain/types";
import {
  deserializeBinaryMaskSurface,
  deserializePixelSurface,
  serializeSurface,
  type SerializedSurface,
} from "./serializedSurface";

export const PROJECT_SCHEMA_VERSION = 9;
const SUPPORTED_PROJECT_SCHEMA_VERSIONS = new Set([6, 7, 8, PROJECT_SCHEMA_VERSION]);

export interface SerializedBaseLayer {
  id: number;
  name: string;
  visible: boolean;
  pixelEditable: boolean;
  contentRevision: number;
  alphaMask?: SerializedSurface;
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

interface SerializedDitherPaletteEntry {
  id: string;
  index: PaletteIndex;
  name: string;
  type: "dither";
  patternId: string;
  foregroundIndex: PaletteIndex;
  backgroundIndex: PaletteIndex;
}

export type SerializedPaletteEntry = PaletteEntry | SerializedDitherPaletteEntry;

export interface SerializedProjectPalette {
  entries: SerializedPaletteEntry[];
}

export interface SerializedObjectDefinition extends SerializedLayerStack {
  id: string;
  name: string;
  layers: SerializedPixelLayer[];
}

export interface PlaydateProjectDocument {
  schemaVersion: 6 | 7 | 8 | 9;
  id: string;
  name: string;
  width: number;
  height: number;
  updatedAt: number;
  snapshot: {
    palette: SerializedProjectPalette;
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

export function serializeProject(snapshot: EditorSnapshot, id: string, name: string): PlaydateProjectDocument {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id,
    name,
    width: PLAYDATE_WIDTH,
    height: PLAYDATE_HEIGHT,
    updatedAt: Date.now(),
    snapshot: {
      palette: serializePalette(snapshot.palette),
      root: serializeLayerStack(snapshot.root),
      objects: snapshot.objects.map(serializeObjectDefinition),
      activeContext: cloneEditContext(snapshot.activeContext),
    },
  };
}

export function deserializeProject(document: PlaydateProjectDocument): EditorSnapshot {
  if (!SUPPORTED_PROJECT_SCHEMA_VERSIONS.has(document.schemaVersion)) {
    throw new Error("Unsupported project schema version.");
  }

  if (document.width !== PLAYDATE_WIDTH || document.height !== PLAYDATE_HEIGHT) {
    throw new Error(`Unsupported project size ${document.width}x${document.height}.`);
  }

  return cloneSnapshot({
    root: deserializeLayerStack(document.snapshot.root),
    objects: document.snapshot.objects.map(deserializeObjectDefinition),
    palette: deserializePalette(document.snapshot.palette),
    activeContext: cloneEditContext(document.snapshot.activeContext),
  });
}

export function exportProjectJson(document: PlaydateProjectDocument): string {
  return JSON.stringify(document, null, 2);
}

export function parseProjectJson(json: string): PlaydateProjectDocument {
  const parsed = JSON.parse(json) as PlaydateProjectDocument;
  if (!parsed || typeof parsed !== "object" || !SUPPORTED_PROJECT_SCHEMA_VERSIONS.has(parsed.schemaVersion)) {
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
  const layers = object.layers.map(deserializePixelLayer);
  return {
    id: object.id,
    name: object.name,
    width: object.width,
    height: object.height,
    background: object.background ?? TRANSPARENT_PIXEL,
    nextLayerId: object.nextLayerId,
    activeLayerIndex: clampLayerIndex(object.activeLayerIndex, layers.length),
    layers,
  };
}

function serializePalette(palette: ProjectPalette): SerializedProjectPalette {
  return {
    entries: palette.entries.map((entry) => ({ ...entry })),
  };
}

function deserializePalette(palette: SerializedProjectPalette): ProjectPalette {
  return repairPalette({
    entries: palette.entries.map(deserializePaletteEntry),
  });
}

function deserializePaletteEntry(entry: SerializedPaletteEntry): PaletteEntry {
  if (entry.type === "solid") return { ...entry };
  if (entry.type === "pattern") {
    return normalizedPatternEntry({
      id: entry.id,
      index: entry.index,
      name: entry.name,
      type: "pattern",
      patternId: entry.patternId,
      previewHue: numberOrDefault(entry.previewHue, Number.NaN),
      offsetX: numberOrZero(entry.offsetX),
      offsetY: numberOrZero(entry.offsetY),
      rotation: normalizeRotation(entry.rotation),
      reflectX: Boolean(entry.reflectX),
      reflectY: Boolean(entry.reflectY),
    });
  }

  return migrateDitherEntry(entry);
}

// Temporary unreleased-project migration shim.
// This exists only to move local test projects from the old dither shape to
// pattern swatches and can be deleted before release once local data is migrated.
function migrateDitherEntry(entry: SerializedDitherPaletteEntry): PatternPaletteEntry {
  const patternId = builtInPattern(entry.patternId) ? entry.patternId : "checker-50";
  return normalizedPatternEntry({
    id: entry.id,
    index: entry.index,
    name: entry.name,
    type: "pattern",
    patternId,
    previewHue: Number.NaN,
    ...DEFAULT_PATTERN_SAMPLING,
  });
}

function repairPalette(palette: ProjectPalette): ProjectPalette {
  const used = new Set<PaletteIndex>();
  const repaired: PaletteEntry[] = [];
  const usedPreviewHues = new Set<number>();

  for (const entry of palette.entries) {
    const index = used.has(entry.index) ? nextAvailableIndex({ entries: repaired }) : entry.index;
    used.add(index);
    if (entry.type === "pattern") {
      const previewHue = repairPatternPreviewHue(entry.previewHue, { entries: repaired }, usedPreviewHues);
      usedPreviewHues.add(previewHue);
      repaired.push(normalizedPatternEntry({ ...entry, index, previewHue }));
    } else {
      repaired.push(repairSolidEntry({ ...entry, index }));
    }
  }

  return { entries: repaired };
}

function repairSolidEntry(entry: SolidPaletteEntry): SolidPaletteEntry {
  if (entry.value === "black" || entry.value === "white" || entry.value === "alpha") return entry;
  return { ...entry, value: "alpha" };
}

function nextAvailableIndex(palette: ProjectPalette): PaletteIndex {
  return nextPatternPaletteIndex(palette) ?? TRANSPARENT_PIXEL;
}

function repairPatternPreviewHue(
  previewHue: number,
  palette: ProjectPalette,
  usedPreviewHues: ReadonlySet<number>,
): number {
  if (!Number.isFinite(previewHue)) return nextPatternPreviewHue(palette);
  const normalizedHue = ((Math.round(previewHue) % 360) + 360) % 360;
  if (!usedPreviewHues.has(normalizedHue)) return normalizedHue;
  return nextDuplicatePatternPreviewHue(palette, normalizedHue);
}

function normalizeRotation(value: number): PatternRotation {
  return value === 90 || value === 180 || value === 270 ? value : 0;
}

function numberOrZero(value: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function numberOrDefault(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
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
  const layers = stack.layers.map(deserializeLayer);
  return {
    width: stack.width,
    height: stack.height,
    background: stack.background ?? WHITE_PIXEL,
    nextLayerId: stack.nextLayerId,
    activeLayerIndex: clampLayerIndex(stack.activeLayerIndex, layers.length),
    layers,
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
    contentRevision: layer.contentRevision,
    alphaMask: layer.alphaMask ? serializeSurface(layer.alphaMask) : undefined,
    surface: serializeSurface(layer.surface),
  };
}

function deserializePixelLayer(layer: SerializedPixelLayer): PixelLayer {
  return {
    type: "pixel",
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    pixelEditable: layer.pixelEditable,
    contentRevision: layer.contentRevision,
    alphaMask: layer.alphaMask ? deserializeBinaryMaskSurface(layer.alphaMask) : undefined,
    surface: deserializePixelSurface(layer.surface),
  };
}

function serializeObjectInstanceLayer(layer: ObjectInstanceLayer): SerializedObjectInstanceLayer {
  return {
    type: "object",
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    pixelEditable: layer.pixelEditable,
    contentRevision: layer.contentRevision,
    alphaMask: layer.alphaMask ? serializeSurface(layer.alphaMask) : undefined,
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
    pixelEditable: layer.pixelEditable,
    contentRevision: layer.contentRevision,
    alphaMask: layer.alphaMask ? deserializeBinaryMaskSurface(layer.alphaMask) : undefined,
    objectId: layer.objectId,
    x: layer.x,
    y: layer.y,
  };
}

function cloneEditContext(context: EditContext): EditContext {
  return context.type === "root" ? { type: "root" } : { type: "object", objectId: context.objectId };
}
