import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchPlaydateStreamInfo,
  sendPlaydateStreamFrame,
  type PlaydateStreamDevice,
  type PlaydateStreamInfo,
} from "../companion/client";
import type { PixelValue, ProjectPalette, Layer, ObjectDefinition } from "../domain/types";
import type { PreviewMode } from "../export/playdateExport";
import { startDesktopStream, stopDesktopStream } from "../desktop/desktopApi";

export type PlaydateStreamState = "idle" | "starting" | "online" | "offline" | "stopping";

export interface PlaydateStreamFrameSource {
  background: PixelValue;
  layers: Layer[];
  objects: ObjectDefinition[];
  palette: ProjectPalette;
  previewMode: PreviewMode;
  documentRevision: number;
}

export interface PlaydateStreamController {
  enabled: boolean;
  streamState: PlaydateStreamState;
  streamStatusLabel: string;
  streamActionDisabled: boolean;
  streamInfo: PlaydateStreamInfo | null;
  primaryHost: string;
  devices: PlaydateStreamDevice[];
  toggleStream: () => void;
}

export function usePlaydateStream(frameSource: PlaydateStreamFrameSource): PlaydateStreamController {
  const [enabled, setEnabled] = useState(false);
  const [streamState, setStreamState] = useState<PlaydateStreamState>("idle");
  const [streamInfo, setStreamInfo] = useState<PlaydateStreamInfo | null>(null);
  const [devices, setDevices] = useState<PlaydateStreamDevice[]>([]);
  const latestFrameRef = useRef(frameSource);
  const lastPostedRevisionRef = useRef<number | null>(null);
  const sendInFlightRef = useRef(false);
  const streamRunIdRef = useRef(0);

  useEffect(() => {
    latestFrameRef.current = frameSource;
  }, [frameSource]);

  const primaryHost = useMemo(() => streamInfo?.hostCandidates[0] ?? "Unavailable", [streamInfo]);
  const streamStatusLabel = statusLabelForState(streamState);
  const streamActionDisabled = streamState === "starting" || streamState === "stopping";

  const resetStreamSnapshot = useCallback((): void => {
    setDevices([]);
    setStreamInfo(null);
    lastPostedRevisionRef.current = null;
  }, []);

  const toggleStream = useCallback((): void => {
    if (enabled) {
      setStreamState("stopping");
      resetStreamSnapshot();
      setEnabled(false);
      return;
    }

    setEnabled(true);
  }, [enabled, resetStreamSnapshot]);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const runId = streamRunIdRef.current + 1;
    const streamId = createStreamId();
    streamRunIdRef.current = runId;
    lastPostedRevisionRef.current = null;
    let sendInterval: number | null = null;
    let refreshInterval: number | null = null;

    const refreshStreamInfo = async (): Promise<void> => {
      try {
        const nextStreamInfo = await fetchPlaydateStreamInfo(controller.signal);
        if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
        setStreamInfo(nextStreamInfo);
        setDevices(nextStreamInfo.devices ?? []);
        setStreamState("online");
      } catch {
        if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
        setStreamState("offline");
        setDevices([]);
        setStreamInfo(null);
      }
    };

    const sendLatestFrame = () => {
      if (controller.signal.aborted || streamRunIdRef.current !== runId || sendInFlightRef.current) return;

      const frame = latestFrameRef.current;
      if (frame.documentRevision === lastPostedRevisionRef.current) return;

      sendInFlightRef.current = true;
      void sendPlaydateStreamFrame(
        frame.layers,
        frame.previewMode,
        frame.documentRevision,
        frame.objects,
        frame.background,
        frame.palette,
        streamId,
        controller.signal,
      )
        .then((result) => {
          if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
          setStreamState("online");
          lastPostedRevisionRef.current = result.revision;
          void refreshStreamInfo();
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
          console.warn(error instanceof Error ? error.message : "Unable to stream to the Playdate.");
          setStreamState("offline");
        })
        .finally(() => {
          if (streamRunIdRef.current === runId) {
            sendInFlightRef.current = false;
          }
        });
    };

    const startStream = async () => {
      try {
        setStreamState("starting");
        await startDesktopStream();
        if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
        await refreshStreamInfo();
        if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
        sendLatestFrame();
        sendInterval = window.setInterval(sendLatestFrame, 100);
        refreshInterval = window.setInterval(() => {
          void refreshStreamInfo();
        }, 3000);
      } catch (error) {
        if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
        console.warn(error instanceof Error ? error.message : "Unable to start the Playdate stream.");
        setStreamState("offline");
        setEnabled(false);
      }
    };

    void startStream();

    return () => {
      controller.abort();
      streamRunIdRef.current += 1;
      if (sendInterval !== null) window.clearInterval(sendInterval);
      if (refreshInterval !== null) window.clearInterval(refreshInterval);
      sendInFlightRef.current = false;
      setStreamState("stopping");
      void Promise.resolve()
        .then(() => stopDesktopStream())
        .catch((error: unknown) => {
          console.warn(error instanceof Error ? error.message : "Unable to stop the Playdate stream.");
        })
        .finally(() => {
          if (streamRunIdRef.current === runId + 1) {
            setStreamState("idle");
          }
        });
    };
  }, [enabled]);

  return {
    enabled,
    streamState,
    streamStatusLabel,
    streamActionDisabled,
    streamInfo,
    primaryHost,
    devices,
    toggleStream,
  };
}

export function statusLabelForState(state: PlaydateStreamState): string {
  switch (state) {
    case "online":
      return "Streaming";
    case "starting":
      return "Starting";
    case "stopping":
      return "Stopping";
    case "offline":
      return "Offline";
    case "idle":
      return "Idle";
  }
}

function createStreamId(): string {
  return `electron-${crypto.randomUUID()}`;
}
