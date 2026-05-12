import { describe, expect, it } from "vitest";
import { createObjectDefinition } from "../domain/layers";
import { objectDropPreviewFromEvent } from "./useCanvasObjectDrop";

const canvas = {
  getBoundingClientRect: () => ({
    bottom: 240,
    height: 240,
    left: 0,
    right: 400,
    top: 0,
    width: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }),
};

describe("objectDropPreviewFromEvent", () => {
  it("centers object placement under the pointer", () => {
    const preview = objectDropPreviewFromEvent({
      canvas,
      enabled: true,
      event: {
        nativeEvent: { clientX: 100, clientY: 60 } as MouseEvent,
        operation: {
          source: { data: { kind: "object", objectId: "sprite" } },
          target: { id: "canvas-stage" },
        },
      },
      height: 240,
      objects: [createObjectDefinition("sprite", "Sprite", 20, 10)],
      width: 400,
    });

    expect(preview).toEqual({ objectId: "sprite", x: 90, y: 55 });
  });

  it("returns no preview when object drops are disabled", () => {
    expect(
      objectDropPreviewFromEvent({
        canvas,
        enabled: false,
        event: {
          nativeEvent: { clientX: 100, clientY: 60 } as MouseEvent,
          operation: {
            source: { data: { kind: "object", objectId: "sprite" } },
            target: { id: "canvas-stage" },
          },
        },
        height: 240,
        objects: [createObjectDefinition("sprite", "Sprite", 20, 10)],
        width: 400,
      }),
    ).toBeNull();
  });

  it("ignores non-canvas targets and non-object drags", () => {
    const object = createObjectDefinition("sprite", "Sprite", 20, 10);

    expect(
      objectDropPreviewFromEvent({
        canvas,
        enabled: true,
        event: {
          nativeEvent: { clientX: 100, clientY: 60 } as MouseEvent,
          operation: {
            source: { data: { kind: "object", objectId: "sprite" } },
            target: { id: "layers" },
          },
        },
        height: 240,
        objects: [object],
        width: 400,
      }),
    ).toBeNull();

    expect(
      objectDropPreviewFromEvent({
        canvas,
        enabled: true,
        event: {
          nativeEvent: { clientX: 100, clientY: 60 } as MouseEvent,
          operation: {
            source: { data: { kind: "layer", objectId: "sprite" } },
            target: { id: "canvas-stage" },
          },
        },
        height: 240,
        objects: [object],
        width: 400,
      }),
    ).toBeNull();
  });
});
