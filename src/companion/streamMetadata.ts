export interface FrameRevisionIdentity {
  revision: number;
  streamId: string;
}

export interface FrameAcceptance {
  accepted: boolean;
  latestRevision: number | null;
  latestStreamId: string | null;
}

export function shouldAcceptFrameRevision(
  latest: FrameRevisionIdentity | null,
  incoming: FrameRevisionIdentity,
): FrameAcceptance {
  if (!latest || incoming.streamId !== latest.streamId || incoming.revision >= latest.revision) {
    return {
      accepted: true,
      latestRevision: incoming.revision,
      latestStreamId: incoming.streamId,
    };
  }

  return {
    accepted: false,
    latestRevision: latest.revision,
    latestStreamId: latest.streamId,
  };
}

export function normalizeStreamId(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const trimmed = rawValue?.trim();
  return trimmed ? trimmed.slice(0, 96) : "electron-stream";
}
