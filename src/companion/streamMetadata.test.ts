import { describe, expect, it } from "vitest";
import {
  PDPS_FRAME_REQUEST_HEADERS,
  PDPS_STREAM_ID_HEADER,
  normalizeStreamId,
  shouldAcceptFrameRevision,
} from "./streamMetadata";

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

  it("declares the stream id CORS request header", () => {
    expect(PDPS_FRAME_REQUEST_HEADERS).toContain(PDPS_STREAM_ID_HEADER);
  });

  it("normalizes missing stream ids to a legacy producer", () => {
    expect(normalizeStreamId(undefined)).toBe("legacy-browser-stream");
    expect(normalizeStreamId(" browser-stream ")).toBe("browser-stream");
  });
});
