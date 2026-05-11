import { describe, expect, it } from "vitest";
import { createEditorCommand, editorCommandHasChanges, snapshotsEqual, type CommandSelectionSnapshot } from "./commands";
import { createDefaultPalette, createRootStack } from "./layers";
import { indexFor } from "./pixelGeometry";
import type { EditorSnapshot } from "./types";

describe("editor commands", () => {
  it("captures immutable before and after snapshots", () => {
    const before = makeSnapshot();
    const after = makeSnapshot();
    const afterLayer = after.root.layers[0];
    if (afterLayer.type !== "pixel") throw new Error("Expected a pixel layer");
    afterLayer.surface.data[indexFor(3, 3)] = 1;

    const command = createEditorCommand("Draw stroke", before, after, {
      afterSelection: emptySelection(),
      beforeSelection: emptySelection(),
    });
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

  it("detects selection-only editor command changes", () => {
    const before = makeSnapshot();
    const after = makeSnapshot();
    const beforeSelection = emptySelection();
    const afterSelection = emptySelection();
    afterSelection.rootSelection = {
      mask: {
        width: 2,
        height: 2,
        data: new Uint8Array([1, 0, 0, 0]),
      },
    };

    const command = createEditorCommand("Set selection", before, after, { afterSelection, beforeSelection });

    expect(snapshotsEqual(command.before, command.after)).toBe(true);
    expect(editorCommandHasChanges(command)).toBe(true);
  });
});

function makeSnapshot(): EditorSnapshot {
  return {
    palette: createDefaultPalette(),
    root: createRootStack(),
    objects: [],
    activeContext: { type: "root" },
  };
}

function emptySelection(): CommandSelectionSnapshot {
  return {
    objectSelection: null,
    rootSelection: null,
  };
}
