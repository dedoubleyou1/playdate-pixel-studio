import { describe, expect, it } from "vitest";
import { createDocumentCommand, snapshotsEqual } from "./commands";
import { createLayer } from "./layers";
import { indexFor } from "./pixelOps";
import type { EditorSnapshot } from "./types";

describe("document commands", () => {
  it("captures immutable before and after snapshots", () => {
    const before = makeSnapshot();
    const after = makeSnapshot();
    after.layers[0].data[indexFor(3, 3)] = 1;

    const command = createDocumentCommand("Draw stroke", before, after);
    after.layers[0].data[indexFor(3, 3)] = 0;

    expect(command.before.layers[0].data[indexFor(3, 3)]).toBe(0);
    expect(command.after.layers[0].data[indexFor(3, 3)]).toBe(1);
  });

  it("detects meaningful snapshot changes", () => {
    const first = makeSnapshot();
    const second = makeSnapshot();
    expect(snapshotsEqual(first, second)).toBe(true);

    second.layers[0].data[indexFor(5, 5)] = 1;
    expect(snapshotsEqual(first, second)).toBe(false);
  });
});

function makeSnapshot(): EditorSnapshot {
  return {
    nextLayerId: 2,
    activeLayerIndex: 0,
    layers: [createLayer(1, "Layer 1")],
  };
}
