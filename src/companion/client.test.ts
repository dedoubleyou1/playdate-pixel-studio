import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopStreamFrameRequest } from "../desktop/desktopApi";
import { createDefaultPalette, createLayer } from "../domain/layers";
import { WHITE_PIXEL } from "../domain/types";
import { sendPlaydateStreamFrame } from "./client";

describe("Playdate stream client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends packed frames through the Electron stream IPC API", async () => {
    const sendFrame = vi.fn().mockResolvedValue({
      ok: true,
      revision: 8,
      streamId: "stream-1",
      bytes: 12_000,
      connectedDevices: 0,
      devices: [],
    });
    vi.stubGlobal("window", {
      pdps: {
        stream: {
          sendFrame,
        },
      },
    });

    await sendPlaydateStreamFrame(
      [createLayer(1, "Layer")],
      "normal",
      8,
      [],
      WHITE_PIXEL,
      createDefaultPalette(),
      "stream-1",
    );

    const [[request]] = sendFrame.mock.calls as Array<[DesktopStreamFrameRequest]>;
    expect(request.revision).toBe(8);
    expect(request.streamId).toBe("stream-1");
    expect(request.flags).toBe(0);
    expect(typeof request.crc32).toBe("number");
    expect(request.payload).toBeInstanceOf(ArrayBuffer);
  });
});
