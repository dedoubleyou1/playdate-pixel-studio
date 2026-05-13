import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchPlaydateStreamHealth,
  fetchPlaydateStreamSession,
  sendPlaydateStreamFrame,
  type PlaydateStreamDevice,
  type PlaydateStreamSession,
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
  session: PlaydateStreamSession | null;
  primaryHost: string;
  lastSentRevision: number | null;
  roundTripMs: number | null;
  connectedDevices: number;
  devices: PlaydateStreamDevice[];
  statusText: string;
  toggleStream: () => void;
}

export function usePlaydateStream(frameSource: PlaydateStreamFrameSource): PlaydateStreamController {
  const [enabled, setEnabled] = useState(false);
  const [streamState, setStreamState] = useState<PlaydateStreamState>("idle");
  const [session, setSession] = useState<PlaydateStreamSession | null>(null);
  const [lastSentRevision, setLastSentRevision] = useState<number | null>(null);
  const [roundTripMs, setRoundTripMs] = useState<number | null>(null);
  const [connectedDevices, setConnectedDevices] = useState(0);
  const [devices, setDevices] = useState<PlaydateStreamDevice[]>([]);
  const [statusText, setStatusText] = useState("Start streaming, then connect the companion.");
  const latestFrameRef = useRef(frameSource);
  const lastPostedRevisionRef = useRef<number | null>(null);
  const sendInFlightRef = useRef(false);
  const streamRunIdRef = useRef(0);
  const preserveStatusOnCleanupRef = useRef(false);

  useEffect(() => {
    latestFrameRef.current = frameSource;
  }, [frameSource]);

  const primaryHost = useMemo(() => session?.hostCandidates[0] ?? "your-computer-ip", [session]);
  const streamStatusLabel = statusLabelForState(streamState);
  const streamActionDisabled = streamState === "starting" || streamState === "stopping";

  const resetStreamSnapshot = useCallback((): void => {
    setConnectedDevices(0);
    setDevices([]);
    setSession(null);
    setLastSentRevision(null);
    setRoundTripMs(null);
    lastPostedRevisionRef.current = null;
  }, []);

  const toggleStream = useCallback((): void => {
    if (enabled) {
      setStreamState("stopping");
      setStatusText("Stopping Playdate stream.");
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

    const refreshSession = async (): Promise<void> => {
      try {
        const [nextSession, health] = await Promise.all([
          fetchPlaydateStreamSession(controller.signal),
          fetchPlaydateStreamHealth(controller.signal),
        ]);
        if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
        setSession(nextSession);
        setConnectedDevices(health.connectedDevices);
        setDevices(nextSession.devices ?? []);
        setStreamState("online");
      } catch {
        if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
        setStreamState("offline");
        setConnectedDevices(0);
        setDevices([]);
        setSession(null);
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
          setLastSentRevision(result.revision);
          setRoundTripMs(result.roundTripMs);
          setStatusText(
            `Streaming document revision ${result.revision} (${result.byteLength.toLocaleString()} bytes).`,
          );
          void refreshSession();
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
          setStreamState("offline");
          setStatusText(error instanceof Error ? error.message : "Unable to stream to the Playdate.");
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
        setStatusText("Starting Playdate stream.");
        await startDesktopStream();
        if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
        await refreshSession();
        if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
        setStatusText("Stream ready. Connect the companion, then edit to send frames.");
        sendLatestFrame();
        sendInterval = window.setInterval(sendLatestFrame, 100);
        refreshInterval = window.setInterval(() => {
          void refreshSession();
        }, 3000);
      } catch (error) {
        if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
        setStreamState("offline");
        setStatusText(error instanceof Error ? error.message : "Unable to start the Playdate stream.");
        preserveStatusOnCleanupRef.current = true;
        setEnabled(false);
      }
    };

    void startStream();

    return () => {
      const preserveStatus = preserveStatusOnCleanupRef.current;
      preserveStatusOnCleanupRef.current = false;
      controller.abort();
      streamRunIdRef.current += 1;
      if (sendInterval !== null) window.clearInterval(sendInterval);
      if (refreshInterval !== null) window.clearInterval(refreshInterval);
      sendInFlightRef.current = false;
      if (!preserveStatus) {
        setStreamState("stopping");
        setStatusText("Stopping Playdate stream.");
      }
      void Promise.resolve()
        .then(() => stopDesktopStream())
        .catch((error: unknown) => {
          console.warn(error instanceof Error ? error.message : "Unable to stop the Playdate stream.");
        })
        .finally(() => {
          if (streamRunIdRef.current === runId + 1 && !preserveStatus) {
            setStreamState("idle");
            setStatusText("Start streaming, then connect the companion.");
          }
        });
    };
  }, [enabled]);

  return {
    enabled,
    streamState,
    streamStatusLabel,
    streamActionDisabled,
    session,
    primaryHost,
    lastSentRevision,
    roundTripMs,
    connectedDevices,
    devices,
    statusText,
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
