import { activeStack } from "../domain/layers";
import { projectPaletteKey } from "../domain/palette";
import { layerThumbnailKey, maskThumbnailKey, objectThumbnailKey } from "../domain/thumbnailKeys";
import type { EditContext, EditorSnapshot, LayerStack, PixelValue } from "../domain/types";
import type { EditorStoreState } from "../state/editorStoreTypes";

export type PanelContextKey = "root" | `object:${string}`;

export interface LayerPanelModel {
  activeLayerHasAlphaMask: boolean;
  activeLayerIndex: number;
  background: PixelValue;
  contextKey: PanelContextKey;
  editTarget: EditorStoreState["editTarget"];
  layerCount: number;
  layers: LayerPanelLayerMeta[];
}

export interface LayerPanelLayerMeta {
  contextKey: PanelContextKey;
  hasAlphaMask: boolean;
  id: number;
  name: string;
  objectId: string | null;
  stackIndex: number;
  type: "pixel" | "object";
  visible: boolean;
  x: number | null;
  y: number | null;
}

export interface ObjectLibraryModel {
  activeObjectId: string | null;
  activeObjectName: string | null;
  draggable: boolean;
  objects: ObjectLibraryObjectMeta[];
}

export interface ObjectLibraryObjectMeta {
  height: number;
  id: string;
  name: string;
  width: number;
}

type LayerPanelState = Pick<EditorStoreState, "activeContext" | "editTarget" | "objects" | "root">;
type ObjectLibraryState = Pick<EditorStoreState, "activeContext" | "objects">;
type ThumbnailState = Pick<EditorStoreState, "objects" | "palette" | "root">;

export function selectLayerPanelModel(state: LayerPanelState): LayerPanelModel {
  const stack = activeStack(state);
  const contextKey = contextKeyFromEditContext(state.activeContext);
  const activeLayer = stack.layers[stack.activeLayerIndex];

  return {
    activeLayerHasAlphaMask: Boolean(activeLayer?.alphaMask),
    activeLayerIndex: stack.activeLayerIndex,
    background: stack.background,
    contextKey,
    editTarget: state.editTarget,
    layerCount: stack.layers.length,
    layers: stack.layers.map((layer, stackIndex) => ({
      contextKey,
      hasAlphaMask: Boolean(layer.alphaMask),
      id: layer.id,
      name: layer.name,
      objectId: layer.type === "object" ? layer.objectId : null,
      stackIndex,
      type: layer.type,
      visible: layer.visible,
      x: layer.type === "object" ? layer.x : null,
      y: layer.type === "object" ? layer.y : null,
    })),
  };
}

export function areLayerPanelModelsEqual(left: LayerPanelModel, right: LayerPanelModel): boolean {
  if (
    left.activeLayerHasAlphaMask !== right.activeLayerHasAlphaMask ||
    left.activeLayerIndex !== right.activeLayerIndex ||
    left.background !== right.background ||
    left.contextKey !== right.contextKey ||
    left.editTarget !== right.editTarget ||
    left.layerCount !== right.layerCount ||
    left.layers.length !== right.layers.length
  ) {
    return false;
  }

  for (let index = 0; index < left.layers.length; index += 1) {
    if (!areLayerMetasEqual(left.layers[index], right.layers[index])) return false;
  }

  return true;
}

export function selectObjectLibraryModel(state: ObjectLibraryState): ObjectLibraryModel {
  let activeObjectId: string | null = null;
  if (state.activeContext.type === "object") {
    activeObjectId = state.activeContext.objectId;
  }
  const activeObject = activeObjectId
    ? state.objects.find((object) => object.id === activeObjectId)
    : null;

  return {
    activeObjectId: activeObject?.id ?? null,
    activeObjectName: activeObject?.name ?? null,
    draggable: state.activeContext.type === "root",
    objects: state.objects.map((object) => ({
      height: object.height,
      id: object.id,
      name: object.name,
      width: object.width,
    })),
  };
}

export function areObjectLibraryModelsEqual(left: ObjectLibraryModel, right: ObjectLibraryModel): boolean {
  if (
    left.activeObjectId !== right.activeObjectId ||
    left.activeObjectName !== right.activeObjectName ||
    left.draggable !== right.draggable ||
    left.objects.length !== right.objects.length
  ) {
    return false;
  }

  for (let index = 0; index < left.objects.length; index += 1) {
    const leftObject = left.objects[index];
    const rightObject = right.objects[index];
    if (
      leftObject.height !== rightObject.height ||
      leftObject.id !== rightObject.id ||
      leftObject.name !== rightObject.name ||
      leftObject.width !== rightObject.width
    ) {
      return false;
    }
  }

  return true;
}

export function selectLayerThumbnailKey(
  state: ThumbnailState,
  contextKey: PanelContextKey,
  layerId: number,
): string {
  const stack = stackForContextKey(state, contextKey);
  const layer = stack?.layers.find((candidate) => candidate.id === layerId);
  if (!layer) return `missing-layer:${contextKey}:${layerId}`;
  return `${layerThumbnailKey(layer, state.objects)}:${projectPaletteKey(state.palette)}`;
}

export function selectMaskThumbnailKey(
  state: Pick<EditorStoreState, "objects" | "root">,
  contextKey: PanelContextKey,
  layerId: number,
): string {
  const stack = stackForContextKey(state, contextKey);
  const layer = stack?.layers.find((candidate) => candidate.id === layerId);
  return maskThumbnailKey(layer?.alphaMask);
}

export function selectObjectThumbnailKey(
  state: Pick<EditorStoreState, "objects" | "palette">,
  objectId: string,
): string {
  const object = state.objects.find((candidate) => candidate.id === objectId);
  if (!object) return `missing-object:${objectId}`;
  return `${objectThumbnailKey(object)}:${projectPaletteKey(state.palette)}`;
}

export function contextQualifiedLayerKey(contextKey: PanelContextKey, layerId: number): string {
  return `${contextKey}:layer:${layerId}`;
}

export function contextKeyFromEditContext(context: EditContext): PanelContextKey {
  return context.type === "root" ? "root" : `object:${context.objectId}`;
}

export function stackForContextKey(
  state: Pick<EditorSnapshot, "objects" | "root">,
  contextKey: PanelContextKey,
): LayerStack | null {
  if (contextKey === "root") return state.root;
  const objectId = contextKey.slice("object:".length);
  return state.objects.find((object) => object.id === objectId) ?? null;
}

function areLayerMetasEqual(left: LayerPanelLayerMeta, right: LayerPanelLayerMeta): boolean {
  return (
    left.contextKey === right.contextKey &&
    left.hasAlphaMask === right.hasAlphaMask &&
    left.id === right.id &&
    left.name === right.name &&
    left.objectId === right.objectId &&
    left.stackIndex === right.stackIndex &&
    left.type === right.type &&
    left.visible === right.visible &&
    left.x === right.x &&
    left.y === right.y
  );
}
