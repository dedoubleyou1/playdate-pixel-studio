import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import { BLACK_PIXEL, MAX_SWATCH_REF, TRANSPARENT_PIXEL, WHITE_PIXEL, type SolidPaletteValue } from "../domain/types";
import { clampLayerIndex, cloneSnapshot } from "../domain/layers";
import {
  normalizedPatternEntry,
  nextDuplicatePatternPreviewHue,
  nextPatternSwatchRef,
  nextPatternPreviewHue,
} from "../domain/palette";
import type {
  EditContext,
  EditorSnapshot,
  Layer,
  LayerStack,
  ObjectDefinition,
  ObjectInstanceLayer,
  PaletteEntry,
  SwatchRef,
  PatternRotation,
  PixelLayer,
  PixelValue,
  ProjectPalette,
  SolidPaletteEntry,
} from "../domain/types";
import {
  decodeSerializedSurfaceData,
  deserializeBinaryMaskSurface,
  deserializePixelSurface,
  serializeSurface,
  type SerializedSurface,
} from "./serializedSurface";

export const PROJECT_SCHEMA_VERSION = 10;
const MAX_OBJECT_DIMENSION = 400;
const BASE64_PATTERN = /^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?$/;

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

export interface SerializedProjectPalette {
  entries: PaletteEntry[];
}

export interface SerializedObjectDefinition extends SerializedLayerStack {
  id: string;
  name: string;
  layers: SerializedPixelLayer[];
}

export interface PlaydateProjectDocument {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
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
  if (document.schemaVersion !== PROJECT_SCHEMA_VERSION) {
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
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed) || parsed.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error("The selected file is not a Playdate Pixel Studio project.");
  }

  validateProjectDocument(parsed);
  return parsed as unknown as PlaydateProjectDocument;
}

function validateProjectDocument(document: Record<string, unknown>): void {
  requireNonEmptyString(document.id, "project id");
  requireString(document.name, "project name");
  requireFiniteNumber(document.updatedAt, "updated timestamp");
  if (document.width !== PLAYDATE_WIDTH || document.height !== PLAYDATE_HEIGHT) {
    invalidProject(`canvas dimensions must be ${PLAYDATE_WIDTH}x${PLAYDATE_HEIGHT}`);
  }

  const snapshot = requireRecord(document.snapshot, "snapshot");
  const palette = validatePalette(snapshot.palette);
  const objects = requireArray(snapshot.objects, "objects");
  const objectDimensions = new Map<string, { width: number; height: number }>();

  for (const [index, value] of objects.entries()) {
    const object = requireRecord(value, `object ${index}`);
    const id = requireNonEmptyString(object.id, `object ${index} id`);
    if (objectDimensions.has(id)) invalidProject(`duplicate object id ${id}`);
    objectDimensions.set(id, {
      width: requireIntegerInRange(object.width, 1, MAX_OBJECT_DIMENSION, `object ${index} width`),
      height: requireIntegerInRange(object.height, 1, MAX_OBJECT_DIMENSION, `object ${index} height`),
    });
  }

  for (const [index, value] of objects.entries()) {
    validateObjectDefinition(requireRecord(value, `object ${index}`), index, palette);
  }

  validateLayerStack(snapshot.root, "root", PLAYDATE_WIDTH, PLAYDATE_HEIGHT, palette, objectDimensions, false);
  validateEditContext(snapshot.activeContext, new Set(objectDimensions.keys()));
}

function validatePalette(value: unknown): Set<number> {
  const palette = requireRecord(value, "palette");
  const entries = requireArray(palette.entries, "palette entries");
  if (entries.length === 0 || entries.length > MAX_SWATCH_REF + 1) {
    invalidProject("palette entry count is invalid");
  }

  const ids = new Set<string>();
  const refs = new Set<number>();
  const solidEntries = new Map<number, SolidPaletteValue>();

  for (const [entryIndex, value] of entries.entries()) {
    const entry = requireRecord(value, `palette entry ${entryIndex}`);
    const id = requireNonEmptyString(entry.id, `palette entry ${entryIndex} id`);
    const ref = requireIntegerInRange(entry.ref, 0, MAX_SWATCH_REF, `palette entry ${entryIndex} ref`);
    requireString(entry.name, `palette entry ${entryIndex} name`);
    if (ids.has(id)) invalidProject(`duplicate palette id ${id}`);
    if (refs.has(ref)) invalidProject(`duplicate palette ref ${ref}`);
    ids.add(id);
    refs.add(ref);

    if (entry.type === "solid") {
      if (entry.value !== "alpha" && entry.value !== "black" && entry.value !== "white") {
        invalidProject(`palette entry ${entryIndex} has an invalid solid value`);
      }
      solidEntries.set(ref, entry.value);
    } else if (entry.type === "pattern") {
      requireNonEmptyString(entry.patternId, `palette entry ${entryIndex} pattern id`);
      requireFiniteNumber(entry.previewHue, `palette entry ${entryIndex} preview hue`);
      requireInteger(entry.offsetX, `palette entry ${entryIndex} x offset`);
      requireInteger(entry.offsetY, `palette entry ${entryIndex} y offset`);
      if (entry.rotation !== 0 && entry.rotation !== 90 && entry.rotation !== 180 && entry.rotation !== 270) {
        invalidProject(`palette entry ${entryIndex} has an invalid rotation`);
      }
      requireBoolean(entry.reflectX, `palette entry ${entryIndex} x reflection`);
      requireBoolean(entry.reflectY, `palette entry ${entryIndex} y reflection`);
    } else {
      invalidProject(`palette entry ${entryIndex} has an invalid type`);
    }
  }

  const requiredSolids: Array<[number, SolidPaletteValue]> = [
    [TRANSPARENT_PIXEL, "alpha"],
    [BLACK_PIXEL, "black"],
    [WHITE_PIXEL, "white"],
  ];
  for (const [index, value] of requiredSolids) {
    if (solidEntries.get(index) !== value) invalidProject(`required ${value} palette entry is missing`);
  }

  return refs;
}

function validateObjectDefinition(object: Record<string, unknown>, index: number, palette: Set<number>): void {
  requireNonEmptyString(object.id, `object ${index} id`);
  requireString(object.name, `object ${index} name`);
  const width = requireIntegerInRange(object.width, 1, MAX_OBJECT_DIMENSION, `object ${index} width`);
  const height = requireIntegerInRange(object.height, 1, MAX_OBJECT_DIMENSION, `object ${index} height`);
  validateLayerStack(object, `object ${index}`, width, height, palette, new Map(), true);
}

function validateLayerStack(
  value: unknown,
  label: string,
  expectedWidth: number,
  expectedHeight: number,
  palette: Set<number>,
  objectDimensions: Map<string, { width: number; height: number }>,
  pixelsOnly: boolean,
): void {
  const stack = requireRecord(value, label);
  if (stack.width !== expectedWidth || stack.height !== expectedHeight) {
    invalidProject(`${label} dimensions do not match its surfaces`);
  }
  if (stack.background !== undefined) validatePaletteIndex(stack.background, palette, `${label} background`);
  const nextLayerId = requireNonNegativeInteger(stack.nextLayerId, `${label} next layer id`);
  const layers = requireArray(stack.layers, `${label} layers`);
  if (layers.length === 0) invalidProject(`${label} must contain at least one layer`);
  requireInteger(stack.activeLayerIndex, `${label} active layer index`);

  const layerIds = new Set<number>();
  for (const [index, value] of layers.entries()) {
    const layer = requireRecord(value, `${label} layer ${index}`);
    const id = requireNonNegativeInteger(layer.id, `${label} layer ${index} id`);
    if (layerIds.has(id)) invalidProject(`${label} has duplicate layer id ${id}`);
    layerIds.add(id);
    requireString(layer.name, `${label} layer ${index} name`);
    requireBoolean(layer.visible, `${label} layer ${index} visibility`);
    requireBoolean(layer.pixelEditable, `${label} layer ${index} pixel editability`);
    requireNonNegativeInteger(layer.contentRevision, `${label} layer ${index} content revision`);

    if (layer.type === "pixel") {
      validateSurface(layer.surface, expectedWidth, expectedHeight, palette, false, `${label} layer ${index} surface`);
    } else if (layer.type === "object" && !pixelsOnly) {
      const objectId = requireNonEmptyString(layer.objectId, `${label} layer ${index} object id`);
      if (!objectDimensions.has(objectId)) invalidProject(`${label} layer ${index} references a missing object`);
      requireInteger(layer.x, `${label} layer ${index} x`);
      requireInteger(layer.y, `${label} layer ${index} y`);
    } else {
      invalidProject(`${label} layer ${index} has an invalid type`);
    }

    if (layer.alphaMask !== undefined) {
      const maskLabel = `${label} layer ${index} alpha mask`;
      if (layer.type === "object") validateBoundedBinarySurface(layer.alphaMask, maskLabel);
      else validateSurface(layer.alphaMask, expectedWidth, expectedHeight, palette, true, maskLabel);
    }
  }

  if (nextLayerId <= Math.max(...layerIds)) invalidProject(`${label} next layer id is already in use`);
}

function validateBoundedBinarySurface(value: unknown, label: string): void {
  const surface = requireRecord(value, label);
  const width = requireIntegerInRange(surface.width, 1, MAX_OBJECT_DIMENSION, `${label} width`);
  const height = requireIntegerInRange(surface.height, 1, MAX_OBJECT_DIMENSION, `${label} height`);
  validateSurface(surface, width, height, new Set(), true, label);
}

function validateSurface(
  value: unknown,
  expectedWidth: number,
  expectedHeight: number,
  palette: Set<number>,
  binary: boolean,
  label: string,
): void {
  const surface = requireRecord(value, label);
  if (surface.width !== expectedWidth || surface.height !== expectedHeight) {
    invalidProject(`${label} dimensions do not match its layer`);
  }
  if (typeof surface.data !== "string") invalidProject(`${label} data is not base64 text`);
  const expectedLength = expectedWidth * expectedHeight;
  const expectedBase64Length = Math.ceil(expectedLength / 3) * 4;
  if (surface.data.length !== expectedBase64Length || !BASE64_PATTERN.test(surface.data)) {
    invalidProject(`${label} data length is invalid`);
  }

  let data: Uint8Array;
  try {
    data = decodeSerializedSurfaceData(surface as unknown as SerializedSurface);
  } catch {
    invalidProject(`${label} data is not valid base64`);
  }
  if (data.length !== expectedLength) invalidProject(`${label} data length is invalid`);
  for (const byte of data) {
    if (binary ? byte !== 0 && byte !== 1 : !palette.has(byte)) {
      invalidProject(binary ? `${label} contains a non-binary value` : `${label} references a missing palette entry`);
    }
  }
}

function validateEditContext(value: unknown, objectIds: Set<string>): void {
  const context = requireRecord(value, "active edit context");
  if (context.type === "root") return;
  if (context.type !== "object") invalidProject("active edit context has an invalid type");
  const objectId = requireNonEmptyString(context.objectId, "active object id");
  if (!objectIds.has(objectId)) invalidProject("active edit context references a missing object");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) invalidProject(`${label} is missing or invalid`);
  return value;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) invalidProject(`${label} is missing or invalid`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") invalidProject(`${label} is missing or invalid`);
  return value;
}

function requireNonEmptyString(value: unknown, label: string): string {
  const string = requireString(value, label);
  if (string.length === 0) invalidProject(`${label} is empty`);
  return string;
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") invalidProject(`${label} is missing or invalid`);
  return value;
}

function requireFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) invalidProject(`${label} is missing or invalid`);
  return value;
}

function requireInteger(value: unknown, label: string): number {
  const number = requireFiniteNumber(value, label);
  if (!Number.isSafeInteger(number)) invalidProject(`${label} must be an integer`);
  return number;
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  return requireIntegerInRange(value, 0, Number.MAX_SAFE_INTEGER, label);
}

function requireIntegerInRange(value: unknown, minimum: number, maximum: number, label: string): number {
  const number = requireInteger(value, label);
  if (number < minimum || number > maximum) invalidProject(`${label} is out of range`);
  return number;
}

function validatePaletteIndex(value: unknown, palette: Set<number>, label: string): void {
  const index = requireIntegerInRange(value, 0, MAX_SWATCH_REF, label);
  if (!palette.has(index)) invalidProject(`${label} references a missing palette entry`);
}

function invalidProject(reason: string): never {
  throw new Error(`Invalid Playdate Pixel Studio project: ${reason}.`);
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

function deserializePaletteEntry(entry: PaletteEntry): PaletteEntry {
  if (entry.type === "solid") {
    return {
      id: entry.id,
      ref: entry.ref,
      name: entry.name,
      type: "solid",
      value: entry.value,
    };
  }
  if (entry.type === "pattern") {
    return normalizedPatternEntry({
      id: entry.id,
      ref: entry.ref,
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
  throw new Error("Unsupported palette entry type.");
}

function repairPalette(palette: ProjectPalette): ProjectPalette {
  const used = new Set<SwatchRef>();
  const repaired: PaletteEntry[] = [];
  const usedPreviewHues = new Set<number>();

  for (const entry of palette.entries) {
    const ref = used.has(entry.ref) ? nextAvailableRef({ entries: repaired }) : entry.ref;
    used.add(ref);
    if (entry.type === "pattern") {
      const previewHue = repairPatternPreviewHue(entry.previewHue, { entries: repaired }, usedPreviewHues);
      usedPreviewHues.add(previewHue);
      repaired.push(normalizedPatternEntry({ ...entry, ref, previewHue }));
    } else {
      repaired.push(repairSolidEntry({ ...entry, ref }));
    }
  }

  return { entries: repaired };
}

function repairSolidEntry(entry: SolidPaletteEntry): SolidPaletteEntry {
  if (entry.value === "black" || entry.value === "white" || entry.value === "alpha") return entry;
  return { ...entry, value: "alpha" };
}

function nextAvailableRef(palette: ProjectPalette): SwatchRef {
  return nextPatternSwatchRef(palette) ?? TRANSPARENT_PIXEL;
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
