import { describe, expect, it } from "vitest";
import { normalizeStreamId, shouldAcceptFrameRevision } from "./streamMetadata";

describe("stream metadata", () => {
  it("rejects lower revisions within the same stream", () => {
    const result = shouldAcceptFrameRevision(
      { revision: 12, streamId: "stream-a" },
      { revision: 4, streamId: "stream-a" },
    );

    expect(result).toEqual({
      accepted: false,
      latestRevision: 12,
      latestStreamId: "stream-a",
    });
  });

  it("accepts lower revisions from a new stream generation", () => {
    const result = shouldAcceptFrameRevision(
      { revision: 12, streamId: "stream-a" },
      { revision: 0, streamId: "stream-b" },
    );

    expect(result).toEqual({
      accepted: true,
      latestRevision: 0,
      latestStreamId: "stream-b",
    });
  });

  it("normalizes missing stream ids to a legacy producer", () => {
    expect(normalizeStreamId(undefined)).toBe("electron-stream");
    expect(normalizeStreamId(" electron-stream ")).toBe("electron-stream");
  });
});
