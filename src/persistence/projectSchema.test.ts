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
    expect(document.snapshot.palette.entries[3]).toMatchObject({ type: "pattern", patternId: "bayer-2x2-1" });
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
    expect(() => parseProjectJson(JSON.stringify({ schemaVersion: 1 }))).toThrow(
      /not a Playdate Pixel Studio project/,
    );
  });

  it("clamps invalid active layer indexes while deserializing", () => {
    const snapshot: EditorSnapshot = {
      palette: createDefaultPalette(),
      root: createRootStack(),
      objects: [createObjectDefinition("object-1", "Object 1", 16, 16)],
      activeContext: { type: "root" },
    };
    const document = serializeProject(snapshot, "project-1", "Invalid Active Layer") as unknown as {
      snapshot: {
        root: { activeLayerIndex: number };
        objects: Array<{ activeLayerIndex: number }>;
      };
    };
    document.snapshot.root.activeLayerIndex = 99;
    document.snapshot.objects[0].activeLayerIndex = 99;

    const restored = deserializeProject(document as never);

    expect(restored.root.activeLayerIndex).toBe(0);
    expect(restored.objects[0].activeLayerIndex).toBe(0);
  });

  it("repairs missing and duplicated swatch preview hues while deserializing", () => {
    const document = serializeProject(
      {
        palette: createDefaultPalette(),
        root: createRootStack(),
        objects: [],
        activeContext: { type: "root" },
      },
      "project-1",
      "Preview Hues",
    ) as unknown as {
      snapshot: {
        palette: {
          entries: Array<Record<string, unknown>>;
        };
      };
    };
    for (const index of [3, 4, 5]) {
      document.snapshot.palette.entries[index].previewHue = 210;
    }

    const restored = deserializeProject(document as never);
    const previewHues = restored.palette.entries
      .filter((entry) => entry.type === "pattern")
      .map((entry) => entry.previewHue);

    expect(previewHues).toEqual([210, 300, 120]);
  });

  it("round-trips pattern sampling settings", () => {
    const snapshot: EditorSnapshot = {
      palette: createDefaultPalette(),
      root: createRootStack(),
      objects: [],
      activeContext: { type: "root" },
    };
    const entry = snapshot.palette.entries[3];
    if (entry.type !== "pattern") throw new Error("Expected pattern swatch");
    snapshot.palette.entries[3] = {
      ...entry,
      offsetX: 3,
      offsetY: -2,
      previewHue: 55,
      reflectX: true,
      rotation: 90,
    };

    const restored = deserializeProject(serializeProject(snapshot, "project-1", "Sampling"));

    expect(restored.palette.entries[3]).toMatchObject({
      offsetX: 3,
      offsetY: -2,
      previewHue: 55,
      reflectX: true,
      reflectY: false,
      rotation: 90,
    });
  });

  it("repairs missing pattern IDs and duplicate swatch refs", () => {
    const document = serializeProject(
      {
        palette: createDefaultPalette(),
        root: createRootStack(),
        objects: [],
        activeContext: { type: "root" },
      },
      "project-1",
      "Invalid Palette",
    );
    const firstPattern = document.snapshot.palette.entries[3];
    const secondPattern = document.snapshot.palette.entries[4];
    if (firstPattern.type !== "pattern" || secondPattern.type !== "pattern") throw new Error("Expected pattern swatches");
    firstPattern.patternId = "missing-pattern";
    secondPattern.ref = firstPattern.ref;

    const restored = deserializeProject(document);

    expect(restored.palette.entries[3]).toMatchObject({ patternId: "bayer-2x2-2" });
    expect(new Set(restored.palette.entries.map((entry) => entry.ref)).size).toBe(restored.palette.entries.length);
  });
});
