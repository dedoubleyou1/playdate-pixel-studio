import { describe, expect, it } from "vitest";
import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import { createDefaultPalette, createObjectDefinition, createRootStack } from "../domain/layers";
import { indexFor } from "../domain/pixelGeometry";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import type { EditorSnapshot } from "../domain/types";
import { deserializeProject, parseProjectJson, PROJECT_SCHEMA_VERSION, serializeProject } from "./projectSchema";

describe("project schema", () => {
  it("round-trips a Playdate project document", () => {
    const snapshot: EditorSnapshot = {
      palette: createDefaultPalette(),
      root: createRootStack(),
      objects: [createObjectDefinition("object-1", "Object 1", 16, 16)],
      activeContext: { type: "root" },
    };
    snapshot.root.background = BLACK_PIXEL;
    snapshot.objects[0].background = TRANSPARENT_PIXEL;
    const layer = snapshot.root.layers[0];
    if (layer.type !== "pixel") throw new Error("Expected a pixel layer");
    layer.surface.data[indexFor(20, 30)] = BLACK_PIXEL;
    layer.surface.data[indexFor(21, 30)] = WHITE_PIXEL;

    const document = serializeProject(snapshot, "project-1", "Test Project");
    const restored = deserializeProject(document);
    const restoredLayer = restored.root.layers[0];

    expect(document.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(document.width).toBe(PLAYDATE_WIDTH);
    expect(document.height).toBe(PLAYDATE_HEIGHT);
    expect(document.snapshot.palette.entries).toHaveLength(snapshot.palette.entries.length);
    expect(document.snapshot.root.layers[0]).toMatchObject({ pixelEditable: true, contentRevision: 0 });
    expect("locked" in document.snapshot.root.layers[0]).toBe(false);
    expect("opacity" in document.snapshot.root.layers[0]).toBe(false);
    expect(restored.root.background).toBe(BLACK_PIXEL);
    expect(restored.objects[0]?.background).toBe(TRANSPARENT_PIXEL);
    expect(restoredLayer.type).toBe("pixel");
    if (restoredLayer.type === "pixel") {
      expect(restoredLayer.surface.data[indexFor(20, 30)]).toBe(BLACK_PIXEL);
      expect(restoredLayer.surface.data[indexFor(21, 30)]).toBe(WHITE_PIXEL);
    }
  });

  it("rejects unsupported imported files", () => {
    expect(() => parseProjectJson("{}")).toThrow(/not a Playdate Pixel Studio project/);
    expect(() => parseProjectJson(JSON.stringify({ schemaVersion: PROJECT_SCHEMA_VERSION - 3 }))).toThrow(
      /not a Playdate Pixel Studio project/,
    );
  });

  it("drops legacy layer opacity when deserializing and reserializing", () => {
    const snapshot: EditorSnapshot = {
      palette: createDefaultPalette(),
      root: createRootStack(),
      objects: [createObjectDefinition("object-1", "Object 1", 16, 16)],
      activeContext: { type: "root" },
    };
    const legacyDocument = serializeProject(snapshot, "project-1", "Legacy Project") as unknown as {
      schemaVersion: 7;
      snapshot: {
        root: { layers: Array<Record<string, unknown>> };
        objects: Array<{ layers: Array<Record<string, unknown>> }>;
      };
    };
    legacyDocument.schemaVersion = 7;
    legacyDocument.snapshot.root.layers[0].opacity = 25;
    legacyDocument.snapshot.objects[0].layers[0].opacity = 50;

    const restored = deserializeProject(legacyDocument as never);
    const reserialized = serializeProject(restored, "project-1", "Legacy Project");

    expect("opacity" in restored.root.layers[0]).toBe(false);
    expect("opacity" in restored.objects[0].layers[0]).toBe(false);
    expect("opacity" in reserialized.snapshot.root.layers[0]).toBe(false);
    expect("opacity" in reserialized.snapshot.objects[0].layers[0]).toBe(false);
  });
});
