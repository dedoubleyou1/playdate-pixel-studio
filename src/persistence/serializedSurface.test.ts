import { describe, expect, it } from "vitest";
import { createSurface } from "../domain/layers";
import { createBinaryMaskSurface } from "../domain/masks";
import { deserializeBinaryMaskSurface, deserializePixelSurface, serializeSurface } from "./serializedSurface";

describe("serialized surface helpers", () => {
  it("round trips pixel surfaces through base64 JSON data", () => {
    const surface = createSurface(2, 2, new Uint8Array([1, 2, 3, 4]));

    const serialized = serializeSurface(surface);
    const restored = deserializePixelSurface(serialized);

    expect(serialized).toEqual({ width: 2, height: 2, data: "AQIDBA==" });
    expect(Array.from(restored.data)).toEqual([1, 2, 3, 4]);
  });

  it("round trips binary masks through the same serialized shape", () => {
    const mask = createBinaryMaskSurface(2, 2);
    mask.data.set([1, 0, 1, 1]);

    const restored = deserializeBinaryMaskSurface(serializeSurface(mask));

    expect(restored.width).toBe(2);
    expect(restored.height).toBe(2);
    expect(Array.from(restored.data)).toEqual([1, 0, 1, 1]);
  });
});
