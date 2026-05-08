import { describe, expect, it } from "vitest";
import { createLayer } from "../domain/layers";
import { indexFor } from "../domain/pixelOps";
import { BLACK_PIXEL } from "../domain/types";
import {
  crc32,
  decodeFramePacket,
  encodeFramePacket,
  packPlaydateFrame,
  PLAYDATE_FRAME_BYTES,
  PLAYDATE_PACKET_HEADER_BYTES,
} from "./protocol";

describe("Playdate companion protocol", () => {
  it("packs a white frame into 12,000 filled bytes", () => {
    const layer = createLayer(1, "Empty");
    const frame = packPlaydateFrame([layer], "normal", 7);

    expect(frame.revision).toBe(7);
    expect(frame.payload.byteLength).toBe(PLAYDATE_FRAME_BYTES);
    expect(frame.payload.every((byte) => byte === 0xff)).toBe(true);
  });

  it("clears black pixels MSB-first in row-major order", () => {
    const layer = createLayer(1, "Pixels");
    layer.surface.data[indexFor(0, 0)] = 1;
    layer.surface.data[indexFor(7, 0)] = 1;
    layer.surface.data[indexFor(8, 0)] = 1;

    const frame = packPlaydateFrame([layer], "normal");

    expect(frame.payload[0]).toBe(0b01111110);
    expect(frame.payload[1]).toBe(0b01111111);
  });

  it("packs a black background into cleared frame bytes", () => {
    const layer = createLayer(1, "Empty");
    const frame = packPlaydateFrame([layer], "normal", 1, [], BLACK_PIXEL);

    expect(frame.payload.every((byte) => byte === 0x00)).toBe(true);
  });

  it("resolves dither palette indexes before packing physical frames", () => {
    const layer = createLayer(1, "Dither");
    layer.surface.data[indexFor(0, 0)] = 4;
    layer.surface.data[indexFor(1, 0)] = 4;
    layer.surface.data[indexFor(1, 1)] = 4;

    const frame = packPlaydateFrame([layer], "normal");

    expect(frame.payload[0]).toBe(0b01111111);
    expect(frame.payload[50]).toBe(0b10111111);
  });

  it("can invert a physical preview frame", () => {
    const layer = createLayer(1, "Pixels");
    layer.surface.data[indexFor(0, 0)] = 1;

    const frame = packPlaydateFrame([layer], "inverted");

    expect(frame.flags).toBe(1);
    expect(frame.payload[0]).toBe(0b10000000);
  });

  it("round-trips encoded packets and rejects corrupted payloads", () => {
    const layer = createLayer(1, "Pixels");
    layer.surface.data[indexFor(4, 0)] = 1;
    const frame = packPlaydateFrame([layer], "normal", 42);

    const packet = encodeFramePacket(frame);
    const decoded = decodeFramePacket(packet);

    expect(packet.byteLength).toBe(PLAYDATE_PACKET_HEADER_BYTES + PLAYDATE_FRAME_BYTES);
    expect(decoded.revision).toBe(42);
    expect(decoded.crc32).toBe(crc32(frame.payload));
    expect([...decoded.payload.slice(0, 1)]).toEqual([...frame.payload.slice(0, 1)]);

    const corrupted = new Uint8Array(packet);
    corrupted[corrupted.length - 1] ^= 0xff;
    expect(() => decodeFramePacket(corrupted)).toThrow(/CRC/);
  });
});
