import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants.ts";
import { WHITE_PIXEL } from "../domain/types.ts";
import type { Layer, ObjectDefinition, PixelValue } from "../domain/types.ts";
import { composeShades } from "../rendering/frameComposer.ts";

export const PLAYDATE_FRAME_BYTES = (PLAYDATE_WIDTH * PLAYDATE_HEIGHT) / 8;
export const PLAYDATE_PACKET_MAGIC = "PDPS";
export const PLAYDATE_PACKET_VERSION = 1;
export const PLAYDATE_PACKET_HEADER_BYTES = 24;
export type PlaydateFrameMode = "normal" | "inverted" | "lcd";

export interface PackedPlaydateFrame {
  width: number;
  height: number;
  revision: number;
  flags: number;
  payload: Uint8Array;
  crc32: number;
  byteLength: number;
}

export interface PlaydateFramePacket {
  width: number;
  height: number;
  revision: number;
  flags: number;
  payload: Uint8Array;
}

export interface DecodedPlaydateFramePacket extends PlaydateFramePacket {
  crc32: number;
}

export function packPlaydateFrame(
  layers: Layer[],
  mode: PlaydateFrameMode = "normal",
  revision = 0,
  objects: ObjectDefinition[] = [],
  background: PixelValue = WHITE_PIXEL,
): PackedPlaydateFrame {
  const payload = new Uint8Array(PLAYDATE_FRAME_BYTES);
  const inverted = mode === "inverted";
  const shades = composeShades(layers, PLAYDATE_WIDTH, PLAYDATE_HEIGHT, objects, background);

  for (let pixel = 0; pixel < PLAYDATE_WIDTH * PLAYDATE_HEIGHT; pixel += 1) {
    const shade = shades[pixel] < 224 ? 0 : 255;
    const black = shade < 224;
    const renderedBlack = black !== inverted;
    if (!renderedBlack) {
      payload[pixel >> 3] |= 0x80 >> (pixel & 7);
    }
  }

  const crc = crc32(payload);
  return {
    width: PLAYDATE_WIDTH,
    height: PLAYDATE_HEIGHT,
    revision: normalizeRevision(revision),
    flags: inverted ? 1 : 0,
    payload,
    crc32: crc,
    byteLength: payload.byteLength,
  };
}

export function encodeFramePacket(packet: PlaydateFramePacket): Uint8Array {
  if (packet.width !== PLAYDATE_WIDTH || packet.height !== PLAYDATE_HEIGHT) {
    throw new Error(`Unsupported Playdate frame size: ${packet.width}x${packet.height}`);
  }
  if (packet.payload.byteLength !== PLAYDATE_FRAME_BYTES) {
    throw new Error(`Expected ${PLAYDATE_FRAME_BYTES} frame bytes, received ${packet.payload.byteLength}`);
  }

  const encoded = new Uint8Array(PLAYDATE_PACKET_HEADER_BYTES + packet.payload.byteLength);
  const view = new DataView(encoded.buffer);
  writeAscii(encoded, 0, PLAYDATE_PACKET_MAGIC);
  view.setUint8(4, PLAYDATE_PACKET_VERSION);
  view.setUint8(5, packet.flags & 0xff);
  view.setUint16(6, PLAYDATE_PACKET_HEADER_BYTES, false);
  view.setUint16(8, packet.width, false);
  view.setUint16(10, packet.height, false);
  view.setUint32(12, normalizeRevision(packet.revision), false);
  view.setUint32(16, packet.payload.byteLength, false);
  view.setUint32(20, crc32(packet.payload), false);
  encoded.set(packet.payload, PLAYDATE_PACKET_HEADER_BYTES);
  return encoded;
}

export function decodeFramePacket(bytes: Uint8Array): DecodedPlaydateFramePacket {
  if (bytes.byteLength < PLAYDATE_PACKET_HEADER_BYTES) {
    throw new Error("Frame packet is shorter than the protocol header.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== PLAYDATE_PACKET_MAGIC) throw new Error("Frame packet has an invalid magic value.");
  if (view.getUint8(4) !== PLAYDATE_PACKET_VERSION) throw new Error("Frame packet version is unsupported.");

  const flags = view.getUint8(5);
  const headerLength = view.getUint16(6, false);
  const width = view.getUint16(8, false);
  const height = view.getUint16(10, false);
  const revision = view.getUint32(12, false);
  const payloadLength = view.getUint32(16, false);
  const expectedCrc = view.getUint32(20, false);

  if (headerLength !== PLAYDATE_PACKET_HEADER_BYTES) throw new Error("Frame packet header length is unsupported.");
  if (width !== PLAYDATE_WIDTH || height !== PLAYDATE_HEIGHT)
    throw new Error("Frame packet dimensions are unsupported.");
  if (payloadLength !== PLAYDATE_FRAME_BYTES) throw new Error("Frame packet payload length is unsupported.");
  if (bytes.byteLength !== headerLength + payloadLength) throw new Error("Frame packet byte length does not match.");

  const payload = bytes.slice(headerLength);
  const actualCrc = crc32(payload);
  if (actualCrc !== expectedCrc) throw new Error("Frame packet CRC check failed.");

  return { width, height, revision, flags, payload, crc32: actualCrc };
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeAscii(target: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    target[offset + index] = value.charCodeAt(index);
  }
}

function normalizeRevision(revision: number): number {
  return Math.max(0, Math.floor(revision)) >>> 0;
}
