import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "./constants";
import { cloneBinaryMaskSurface } from "./masks";
import { defaultProjectPalette } from "./palette";
import { MAX_PALETTE_INDEX, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";
import type {
  EditContext,
  EditorSnapshot,
  Layer,
  LayerStack,
  ObjectDefinition,
  ObjectInstanceLayer,
  PaletteEntry,
  PixelLayer,
  PixelSurface,
  PixelValue,
  ProjectPalette,
} from "./types";

export function createSurface(width: number, height: number, data?: Uint8Array): PixelSurface {
  const expectedLength = width * height;
  return {
    width,
    height,
    data: data ? normalizeSurfaceData(data, expectedLength) : new Uint8Array(expectedLength),
  };
}

export function resizeSurface(surface: PixelSurface, width: number, height: number): PixelSurface {
  const resized = createSurface(width, height);
  const copyWidth = Math.min(surface.width, width);
  const copyHeight = Math.min(surface.height, height);

  for (let y = 0; y < copyHeight; y += 1) {
    const sourceStart = y * surface.width;
    const targetStart = y * width;
    resized.data.set(surface.data.slice(sourceStart, sourceStart + copyWidth), targetStart);
  }

  return resized;
}

export function createLayer(id: number, name: string, width = PLAYDATE_WIDTH, height = PLAYDATE_HEIGHT): PixelLayer {
  return {
    type: "pixel",
    id,
    name,
    visible: true,
    pixelEditable: true,
    contentRevision: 0,
    surface: createSurface(width, height),
  };
}

export function createObjectInstanceLayer(id: number, name: string, objectId: string): ObjectInstanceLayer {
  return {
    type: "object",
    id,
    name,
    visible: true,
    pixelEditable: false,
    contentRevision: 0,
    objectId,
    x: 0,
    y: 0,
  };
}

export function createRootStack(): LayerStack {
  return {
    width: PLAYDATE_WIDTH,
    height: PLAYDATE_HEIGHT,
    background: WHITE_PIXEL,
    nextLayerId: 2,
    activeLayerIndex: 0,
    layers: [createLayer(1, "Layer 1", PLAYDATE_WIDTH, PLAYDATE_HEIGHT)],
  };
}

export function createObjectDefinition(id: string, name: string, width: number, height: number): ObjectDefinition {
  return {
    id,
    name,
    width,
    height,
    background: TRANSPARENT_PIXEL,
    nextLayerId: 2,
    activeLayerIndex: 0,
    layers: [createLayer(1, "Layer 1", width, height)],
  };
}

export function cloneSurface(surface: PixelSurface): PixelSurface {
  return {
    width: surface.width,
    height: surface.height,
    data: new Uint8Array(surface.data),
  };
}

export function cloneLayer(layer: Layer): Layer {
  const alphaMask = layer.alphaMask ? cloneBinaryMaskSurface(layer.alphaMask) : undefined;
  if (layer.type === "object") {
    return { ...layer, alphaMask };
  }

  return {
    ...layer,
    alphaMask,
    surface: cloneSurface(layer.surface),
  };
}

export function cloneObjectDefinition(object: ObjectDefinition): ObjectDefinition {
  return {
    ...object,
    layers: object.layers.map((layer) => cloneLayer(layer) as PixelLayer),
  };
}

export function cloneLayerStack(stack: LayerStack): LayerStack {
  return {
    width: stack.width,
    height: stack.height,
    background: stack.background,
    nextLayerId: stack.nextLayerId,
    activeLayerIndex: stack.activeLayerIndex,
    layers: stack.layers.map(cloneLayer),
  };
}

export function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    palette: clonePalette(snapshot.palette),
    root: cloneLayerStack(snapshot.root),
    objects: snapshot.objects.map(cloneObjectDefinition),
    activeContext: cloneEditContext(snapshot.activeContext),
  };
}

export function createDefaultPalette(): ProjectPalette {
  return clonePalette(defaultProjectPalette());
}

export function activeStack(snapshot: Pick<EditorSnapshot, "root" | "objects" | "activeContext">): LayerStack {
  if (snapshot.activeContext.type === "root") return snapshot.root;
  const context = snapshot.activeContext;
  return snapshot.objects.find((object) => object.id === context.objectId) ?? snapshot.root;
}

export function activeLayer(snapshot: Pick<EditorSnapshot, "root" | "objects" | "activeContext">): Layer {
  const stack = activeStack(snapshot);
  return stack.layers[stack.activeLayerIndex];
}

export function activePixelLayer(
  snapshot: Pick<EditorSnapshot, "root" | "objects" | "activeContext">,
): PixelLayer | null {
  const layer = activeLayer(snapshot);
  return isPixelEditableLayer(layer) ? layer : null;
}

export function isPixelEditableLayer(layer: Layer | null | undefined): layer is PixelLayer {
  return layer?.type === "pixel" && layer.pixelEditable;
}

export function cloneEditContext(context: EditContext): EditContext {
  return context.type === "root" ? { type: "root" } : { type: "object", objectId: context.objectId };
}

export function clampLayerIndex(index: number, layerCount: number): number {
  return Math.max(0, Math.min(index, layerCount - 1));
}

function normalizeSurfaceData(data: Uint8Array, expectedLength: number): Uint8Array {
  const normalized = new Uint8Array(expectedLength);
  const length = Math.min(data.length, expectedLength);
  for (let index = 0; index < length; index += 1) {
    normalized[index] = normalizePixelValue(data[index]);
  }
  return normalized;
}

function normalizePixelValue(value: number): PixelValue {
  return Number.isInteger(value) && value >= 0 && value <= MAX_PALETTE_INDEX ? value : TRANSPARENT_PIXEL;
}

function clonePalette(palette: ProjectPalette): ProjectPalette {
  return {
    entries: palette.entries.map(clonePaletteEntry),
  };
}

function clonePaletteEntry(entry: PaletteEntry): PaletteEntry {
  return { ...entry };
}
