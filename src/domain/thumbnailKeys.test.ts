import { describe, expect, it } from "vitest";
import { createLayer, createObjectDefinition, createObjectInstanceLayer } from "./layers";
import { WHITE_PIXEL } from "./types";
import { layerThumbnailKey, objectThumbnailKey } from "./thumbnailKeys";

describe("thumbnail keys", () => {
  it("keeps pixel layer thumbnails stable for metadata-only changes", () => {
    const layer = createLayer(1, "Layer");
    const renamed = { ...layer, name: "Renamed", visible: false, opacity: 20 };

    expect(layerThumbnailKey(layer, [])).toBe(layerThumbnailKey(renamed, []));
  });

  it("changes pixel layer thumbnails when pixel content changes", () => {
    const layer = createLayer(1, "Layer");
    const changed = { ...layer, contentRevision: layer.contentRevision + 1 };

    expect(layerThumbnailKey(layer, [])).not.toBe(layerThumbnailKey(changed, []));
  });

  it("changes object thumbnails when composite inputs change", () => {
    const object = createObjectDefinition("object-1", "Object", 16, 16);
    const originalKey = objectThumbnailKey(object);

    object.layers[0].contentRevision += 1;
    expect(objectThumbnailKey(object)).not.toBe(originalKey);

    const contentKey = objectThumbnailKey(object);
    object.layers[0].visible = false;
    expect(objectThumbnailKey(object)).not.toBe(contentKey);

    const visibilityKey = objectThumbnailKey(object);
    object.background = WHITE_PIXEL;
    expect(objectThumbnailKey(object)).not.toBe(visibilityKey);
  });

  it("uses referenced object content for object layer thumbnails", () => {
    const object = createObjectDefinition("object-1", "Object", 16, 16);
    const layer = createObjectInstanceLayer(1, "Object", object.id);
    const originalKey = layerThumbnailKey(layer, [object]);

    object.layers[0].contentRevision += 1;

    expect(layerThumbnailKey(layer, [object])).not.toBe(originalKey);
  });
});
