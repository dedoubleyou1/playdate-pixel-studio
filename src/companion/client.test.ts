import { afterEach, describe, expect, it, vi } from "vitest";
import { createLayer } from "../domain/layers";
import { WHITE_PIXEL } from "../domain/types";
import { sendFrameToBridge } from "./client";
import { PDPS_STREAM_ID_HEADER } from "./streamMetadata";

describe("companion bridge client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts frames with the supplied document revision and stream id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ revision: 8, streamId: "stream-1" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    await sendFrameToBridge([createLayer(1, "Layer")], "normal", 8, [], WHITE_PIXEL, "stream-1");

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      [PDPS_STREAM_ID_HEADER]: "stream-1",
      "x-pdps-revision": "8",
    });
  });
});
