import { describe, expect, it } from "vitest";
import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import { createRootStack } from "../domain/layers";
import { indexFor } from "../domain/pixelOps";
import { BLACK_PIXEL, WHITE_PIXEL } from "../domain/types";
import type { EditorSnapshot } from "../domain/types";
import { deserializeProject, parseProjectJson, PROJECT_SCHEMA_VERSION, serializeProject } from "./projectSchema";

describe("project schema", () => {
  it("round-trips a Playdate project document", () => {
    const snapshot: EditorSnapshot = {
      root: createRootStack(),
      objects: [],
      activeContext: { type: "root" },
    };
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
    expect(restoredLayer.type).toBe("pixel");
    if (restoredLayer.type === "pixel") {
      expect(restoredLayer.surface.data[indexFor(20, 30)]).toBe(BLACK_PIXEL);
      expect(restoredLayer.surface.data[indexFor(21, 30)]).toBe(WHITE_PIXEL);
    }
  });

  it("rejects unsupported imported files", () => {
    expect(() => parseProjectJson("{}")).toThrow(/not a Playdate Pixel Studio project/);
  });
});
