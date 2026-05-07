import { describe, expect, it } from "vitest";
import { createDocumentCommand, snapshotsEqual } from "./commands";
import { createRootStack } from "./layers";
import { indexFor } from "./pixelOps";
import type { EditorSnapshot } from "./types";

describe("document commands", () => {
  it("captures immutable before and after snapshots", () => {
    const before = makeSnapshot();
    const after = makeSnapshot();
    const afterLayer = after.root.layers[0];
    if (afterLayer.type !== "pixel") throw new Error("Expected a pixel layer");
    afterLayer.surface.data[indexFor(3, 3)] = 1;

    const command = createDocumentCommand("Draw stroke", before, after);
    afterLayer.surface.data[indexFor(3, 3)] = 0;
    const beforeLayer = command.before.root.layers[0];
    const commandAfterLayer = command.after.root.layers[0];

    expect(beforeLayer.type).toBe("pixel");
    expect(commandAfterLayer.type).toBe("pixel");
    if (beforeLayer.type === "pixel" && commandAfterLayer.type === "pixel") {
      expect(beforeLayer.surface.data[indexFor(3, 3)]).toBe(0);
      expect(commandAfterLayer.surface.data[indexFor(3, 3)]).toBe(1);
    }
  });

  it("detects meaningful snapshot changes", () => {
    const first = makeSnapshot();
    const second = makeSnapshot();
    expect(snapshotsEqual(first, second)).toBe(true);

    const layer = second.root.layers[0];
    if (layer.type !== "pixel") throw new Error("Expected a pixel layer");
    layer.surface.data[indexFor(5, 5)] = 1;
    expect(snapshotsEqual(first, second)).toBe(false);
  });
});

function makeSnapshot(): EditorSnapshot {
  return {
    root: createRootStack(),
    objects: [],
    activeContext: { type: "root" },
  };
}
