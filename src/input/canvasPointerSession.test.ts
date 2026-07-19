import { describe, expect, it, vi } from "vitest";
import { CanvasPointerSession, suppressCanvasContextMenu } from "./canvasPointerSession";

describe("canvas pointer session", () => {
  it("tracks the primary left-button pointer until it ends", () => {
    const session = new CanvasPointerSession();

    expect(session.begin({ button: 0, isPrimary: true, pointerId: 7 })).toBe(true);
    expect(session.owns(7)).toBe(true);
    expect(session.acceptsMove(7)).toBe(true);

    expect(session.end(7)).toBe(true);
    expect(session.owns(7)).toBe(false);
    expect(session.acceptsMove(9)).toBe(true);
  });

  it("rejects non-primary pointers and non-left buttons", () => {
    const session = new CanvasPointerSession();

    expect(session.begin({ button: 0, isPrimary: false, pointerId: 1 })).toBe(false);
    expect(session.begin({ button: 1, isPrimary: true, pointerId: 2 })).toBe(false);
    expect(session.begin({ button: 2, isPrimary: true, pointerId: 3 })).toBe(false);
    expect(session.acceptsMove(4)).toBe(true);
  });

  it("ignores secondary pointers without releasing the originating pointer", () => {
    const session = new CanvasPointerSession();
    expect(session.begin({ button: 0, isPrimary: true, pointerId: 11 })).toBe(true);

    expect(session.begin({ button: 0, isPrimary: true, pointerId: 12 })).toBe(false);
    expect(session.acceptsMove(12)).toBe(false);
    expect(session.end(12)).toBe(false);
    expect(session.owns(11)).toBe(true);

    expect(session.end(11)).toBe(true);
    expect(session.begin({ button: 0, isPrimary: true, pointerId: 12 })).toBe(true);
  });

  it("suppresses the native context menu over the drawing canvas", () => {
    const preventDefault = vi.fn();

    suppressCanvasContextMenu({ preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
  });
});
