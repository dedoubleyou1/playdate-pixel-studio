import { describe, expect, it } from "vitest";
import { EDITOR_CLIPBOARD_KIND, EDITOR_CLIPBOARD_SCHEMA_VERSION, type EditorClipboard } from "../domain/clipboard";
import { createSurface } from "../domain/layers";
import { createBinaryMaskSurface } from "../domain/masks";
import { parseEditorClipboardJson, serializeEditorClipboard } from "./clipboardSchema";

describe("clipboard schema", () => {
  it("round trips editor clipboard payloads", () => {
    const mask = createBinaryMaskSurface(2, 2);
    mask.data.set([1, 0, 1, 1]);
    const clipboard: EditorClipboard = {
      kind: EDITOR_CLIPBOARD_KIND,
      origin: { x: 3, y: 4 },
      schemaVersion: EDITOR_CLIPBOARD_SCHEMA_VERSION,
      surface: createSurface(2, 2, new Uint8Array([1, 0, 2, 3])),
      mask,
    };

    const restored = parseEditorClipboardJson(serializeEditorClipboard(clipboard));

    expect(restored?.origin).toEqual({ x: 3, y: 4 });
    expect(Array.from(restored?.surface.data ?? [])).toEqual([1, 0, 2, 3]);
    expect(Array.from(restored?.mask.data ?? [])).toEqual([1, 0, 1, 1]);
  });

  it("rejects unsupported or malformed clipboard JSON", () => {
    const valid = JSON.parse(
      serializeEditorClipboard({
        kind: EDITOR_CLIPBOARD_KIND,
        origin: { x: 0, y: 0 },
        schemaVersion: EDITOR_CLIPBOARD_SCHEMA_VERSION,
        surface: createSurface(1, 1, new Uint8Array([1])),
        mask: createBinaryMaskSurface(1, 1, true),
      }),
    ) as Record<string, unknown>;

    expect(parseEditorClipboardJson("{")).toBeNull();
    expect(parseEditorClipboardJson(JSON.stringify({ ...valid, schemaVersion: 99 }))).toBeNull();
    expect(parseEditorClipboardJson(JSON.stringify({ ...valid, kind: "other" }))).toBeNull();
    expect(parseEditorClipboardJson(JSON.stringify({ ...valid, surface: { width: 2, height: 2, data: "AQ==" } }))).toBeNull();
    expect(parseEditorClipboardJson(JSON.stringify({ ...valid, mask: { width: 1, height: 1, data: "Ag==" } }))).toBeNull();
  });
});
