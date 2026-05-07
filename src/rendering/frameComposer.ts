import type { Layer, ObjectDefinition, ObjectInstanceLayer, PixelLayer } from "../domain/types.ts";

export function composeShades(
  layers: Layer[],
  width: number,
  height: number,
  objects: ObjectDefinition[] = [],
): Uint8ClampedArray {
  const shades = new Uint8ClampedArray(width * height);
  shades.fill(255);

  for (const layer of layers) {
    if (!layer.visible) continue;
    if (layer.type === "pixel") {
      compositePixelLayer(shades, width, height, layer);
    } else {
      compositeObjectLayer(shades, width, height, layer, objects);
    }
  }

  return shades;
}

function compositePixelLayer(shades: Uint8ClampedArray, width: number, height: number, layer: PixelLayer): void {
  const alpha = Math.max(0, Math.min(1, layer.opacity / 100));
  const sourceWidth = layer.surface.width;
  const sourceHeight = layer.surface.height;

  for (let y = 0; y < Math.min(height, sourceHeight); y += 1) {
    for (let x = 0; x < Math.min(width, sourceWidth); x += 1) {
      const sourceIndex = y * sourceWidth + x;
      if (layer.surface.data[sourceIndex] === 0) continue;
      const targetIndex = y * width + x;
      shades[targetIndex] = Math.round(shades[targetIndex] * (1 - alpha));
    }
  }
}

function compositeObjectLayer(
  shades: Uint8ClampedArray,
  width: number,
  height: number,
  layer: ObjectInstanceLayer,
  objects: ObjectDefinition[],
): void {
  const object = objects.find((candidate) => candidate.id === layer.objectId);
  if (!object) return;

  const objectShades = composeShades(object.layers, object.width, object.height, objects);
  const alpha = Math.max(0, Math.min(1, layer.opacity / 100));

  for (let y = 0; y < object.height; y += 1) {
    const targetY = layer.y + y;
    if (targetY < 0 || targetY >= height) continue;
    for (let x = 0; x < object.width; x += 1) {
      const targetX = layer.x + x;
      if (targetX < 0 || targetX >= width) continue;

      const sourceShade = objectShades[y * object.width + x];
      if (sourceShade === 255) continue;

      const targetIndex = targetY * width + targetX;
      shades[targetIndex] = Math.round(shades[targetIndex] * (1 - alpha) + sourceShade * alpha);
    }
  }
}
