import { describe, expect, it } from "vitest";
import { createSpriteSheetMetadata, applyPreviewMode } from "./playdateExport";

describe("Playdate exports", () => {
  it("describes the Playdate screen as a one-frame sprite sheet", () => {
    expect(createSpriteSheetMetadata()).toMatchObject({
      width: 400,
      height: 240,
      frames: 1,
      frameWidth: 400,
      frameHeight: 240,
      target: "playdate",
    });
  });

  it("applies preview modes to device image data", () => {
    const image = {
      width: 1,
      height: 1,
      colorSpace: "srgb",
      data: new Uint8ClampedArray([255, 255, 255, 255]),
    } as ImageData;

    applyPreviewMode(image, "inverted");
    expect([...image.data]).toEqual([0, 0, 0, 255]);
  });
});
