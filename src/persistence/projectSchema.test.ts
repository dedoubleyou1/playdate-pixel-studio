import { describe, expect, it } from "vitest";
import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import { createLayer } from "../domain/layers";
import { indexFor } from "../domain/pixelOps";
import type { EditorSnapshot } from "../domain/types";
import { deserializeProject, parseProjectJson, serializeProject } from "./projectSchema";

describe("project schema", () => {
  it("round-trips a Playdate project document", () => {
    const snapshot: EditorSnapshot = {
      nextLayerId: 2,
      activeLayerIndex: 0,
      layers: [createLayer(1, "Layer 1")],
    };
    snapshot.layers[0].data[indexFor(20, 30)] = 1;

    const document = serializeProject(snapshot, "project-1", "Test Project");
    const restored = deserializeProject(document);

    expect(document.width).toBe(PLAYDATE_WIDTH);
    expect(document.height).toBe(PLAYDATE_HEIGHT);
    expect(restored.layers[0].data[indexFor(20, 30)]).toBe(1);
  });

  it("rejects unsupported imported files", () => {
    expect(() => parseProjectJson("{}")).toThrow(/not a Playdate Pixel Studio project/);
  });
});
