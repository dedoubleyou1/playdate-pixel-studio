import type { Layer, ObjectDefinition, PixelLayer } from "./types";

export function layerThumbnailKey(layer: Layer, objects: ObjectDefinition[]): string {
  if (layer.type === "pixel") {
    return pixelLayerContentKey(layer);
  }

  const object = objects.find((candidate) => candidate.id === layer.objectId);
  return `object-layer:${layer.objectId}:${object ? objectThumbnailKey(object) : "missing"}`;
}

export function objectThumbnailKey(object: ObjectDefinition): string {
  return [
    "object",
    object.id,
    object.width,
    object.height,
    object.background,
    object.layers.map(pixelLayerCompositeKey).join(";"),
  ].join(":");
}

function pixelLayerContentKey(layer: PixelLayer): string {
  return ["pixel", layer.id, layer.surface.width, layer.surface.height, layer.contentRevision].join(":");
}

function pixelLayerCompositeKey(layer: PixelLayer): string {
  return [
    "pixel",
    layer.id,
    layer.surface.width,
    layer.surface.height,
    layer.visible ? "visible" : "hidden",
    layer.opacity,
    layer.contentRevision,
  ].join(":");
}
