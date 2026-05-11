import type { BinaryMaskSurface, Layer, ObjectDefinition, PixelLayer } from "./types";

export function layerThumbnailKey(layer: Layer, objects: ObjectDefinition[]): string {
  if (layer.type === "pixel") {
    return pixelLayerContentKey(layer);
  }

  const object = objects.find((candidate) => candidate.id === layer.objectId);
  return `object-layer:${layer.objectId}:${object ? objectThumbnailKey(object) : "missing"}:${maskThumbnailKey(layer.alphaMask)}`;
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
  return [
    "pixel",
    layer.id,
    layer.surface.width,
    layer.surface.height,
    layer.contentRevision,
    maskThumbnailKey(layer.alphaMask),
  ].join(":");
}

function pixelLayerCompositeKey(layer: PixelLayer): string {
  return [
    "pixel",
    layer.id,
    layer.surface.width,
    layer.surface.height,
    layer.visible ? "visible" : "hidden",
    layer.contentRevision,
    maskThumbnailKey(layer.alphaMask),
  ].join(":");
}

export function maskThumbnailKey(mask: BinaryMaskSurface | null | undefined): string {
  if (!mask) return "mask:none";
  let hash = 2166136261;
  for (let index = 0; index < mask.data.length; index += 1) {
    hash ^= mask.data[index];
    hash = Math.imul(hash, 16777619);
  }
  return `mask:${mask.width}x${mask.height}:${hash >>> 0}`;
}
