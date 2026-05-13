import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RadioTower, Square, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  fetchBridgeHealth,
  fetchBridgeSession,
  sendFrameToBridge,
  type BridgeDevice,
  type BridgeSession,
} from "../companion/client";
import { startDesktopBridge, stopDesktopBridge } from "../desktop/desktopApi";
import { useEditorStore } from "../state/editorStore";

type BridgeState = "idle" | "starting" | "online" | "offline" | "stopping";

export function PlaydateStreamMenu(): React.JSX.Element {
  const layers = useEditorStore((state) => state.root.layers);
  const background = useEditorStore((state) => state.root.background);
  const objects = useEditorStore((state) => state.objects);
  const palette = useEditorStore((state) => state.palette);
  const documentRevision = useEditorStore((state) => state.documentRevision);
  const previewMode = useEditorStore((state) => state.previewMode);
  const [enabled, setEnabled] = useState(false);
  const [bridgeState, setBridgeState] = useState<BridgeState>("idle");
  const [session, setSession] = useState<BridgeSession | null>(null);
  const [lastSentRevision, setLastSentRevision] = useState<number | null>(null);
  const [roundTripMs, setRoundTripMs] = useState<number | null>(null);
  const [connectedDevices, setConnectedDevices] = useState(0);
  const [devices, setDevices] = useState<BridgeDevice[]>([]);
  const [statusText, setStatusText] = useState("Start streaming, then connect the companion.");
  const latestFrameRef = useRef({ background, layers, objects, palette, previewMode, documentRevision });
  const lastPostedRevisionRef = useRef<number | null>(null);
  const sendInFlightRef = useRef(false);
  const streamRunIdRef = useRef(0);

  const primaryHost = useMemo(() => session?.hostCandidates[0] ?? "your-computer-ip", [session]);
  const bridgeStatusLabel =
    bridgeState === "online"
      ? "Streaming"
      : bridgeState === "starting"
        ? "Starting"
        : bridgeState === "stopping"
          ? "Stopping"
          : bridgeState === "idle"
            ? "Idle"
            : "Offline";
  const streamActionDisabled = bridgeState === "starting" || bridgeState === "stopping";

  useEffect(() => {
    latestFrameRef.current = { background, layers, objects, palette, previewMode, documentRevision };
  }, [background, layers, objects, palette, previewMode, documentRevision]);

  const refreshSession = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const [nextSession, health] = await Promise.all([fetchBridgeSession(signal), fetchBridgeHealth(signal)]);
        if (signal?.aborted) return;
        setSession(nextSession);
        setConnectedDevices(health.connectedDevices);
        setDevices(nextSession.devices ?? []);
        setBridgeState("online");
        if (!enabled) {
          setStatusText("Stream stopped.");
        }
      } catch {
        if (!signal?.aborted) {
          setBridgeState("offline");
          setConnectedDevices(0);
          setDevices([]);
          setSession(null);
          if (!enabled) {
            setStatusText("Start streaming, then connect the companion.");
          }
        }
      }
    },
    [enabled],
  );

  const toggleStream = useCallback((): void => {
    if (enabled) {
      setBridgeState("stopping");
      setStatusText("Stopping Playdate stream.");
      setConnectedDevices(0);
      setDevices([]);
      setSession(null);
      setLastSentRevision(null);
      setRoundTripMs(null);
      lastPostedRevisionRef.current = null;
      setEnabled(false);
      return;
    }

    setEnabled(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const runId = streamRunIdRef.current + 1;
    const streamId = createStreamId();
    streamRunIdRef.current = runId;
    lastPostedRevisionRef.current = null;
    let sendInterval: number | null = null;
    let refreshInterval: number | null = null;

    const sendLatestFrame = () => {
      if (controller.signal.aborted || streamRunIdRef.current !== runId || sendInFlightRef.current) return;

      const frame = latestFrameRef.current;
      if (frame.documentRevision === lastPostedRevisionRef.current) return;

      sendInFlightRef.current = true;
      void sendFrameToBridge(
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
          setBridgeState("online");
          lastPostedRevisionRef.current = result.revision;
          setLastSentRevision(result.revision);
          setRoundTripMs(result.roundTripMs);
          setStatusText(
            `Streaming document revision ${result.revision} (${result.byteLength.toLocaleString()} bytes).`,
          );
          void refreshSession(controller.signal);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setBridgeState("offline");
          setStatusText(error instanceof Error ? error.message : "Unable to stream to the bridge.");
        })
        .finally(() => {
          if (streamRunIdRef.current === runId) {
            sendInFlightRef.current = false;
          }
        });
    };

    const startStream = async () => {
      try {
        setBridgeState("starting");
        setStatusText("Starting Playdate stream.");
        await startDesktopBridge();
        if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
        await refreshSession(controller.signal);
        if (controller.signal.aborted || streamRunIdRef.current !== runId) return;
        setStatusText("Stream ready. Connect the companion, then edit to send frames.");
        sendLatestFrame();
        sendInterval = window.setInterval(sendLatestFrame, 100);
        refreshInterval = window.setInterval(() => {
          void refreshSession(controller.signal);
        }, 3000);
      } catch (error) {
        if (controller.signal.aborted) return;
        setBridgeState("offline");
        setStatusText(error instanceof Error ? error.message : "Unable to start the Playdate stream.");
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
      setBridgeState("stopping");
      setStatusText("Stopping Playdate stream.");
      void stopDesktopBridge()
        .catch((error: unknown) => {
          console.warn(error instanceof Error ? error.message : "Unable to stop the Playdate stream.");
        })
        .finally(() => {
          if (streamRunIdRef.current === runId + 1) {
            setBridgeState("idle");
            setStatusText("Start streaming, then connect the companion.");
          }
        });
    };
  }, [enabled, refreshSession]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={enabled ? "secondary" : "default"}>
          <RadioTower />
          {enabled ? "Streaming" : "Stream to Playdate"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="playdate-stream-menu" align="end">
        <div className="stream-menu-header">
          <div>
            <h2 className="text-sm font-medium">Playdate Stream</h2>
            <p className="mt-1 text-xs text-muted-foreground">{statusText}</p>
          </div>
          <div className={`bridge-status is-${bridgeState}`}>
            <Wifi size={15} aria-hidden />
            {bridgeStatusLabel}
          </div>
        </div>

        <div className="stream-readout-grid">
          <Readout label="Session" value={session?.sessionCode ?? "------"} />
          <Readout label="Target" value={`${primaryHost}:${session?.streamPort ?? 9138}`} />
          <Readout label="Revision" value={lastSentRevision?.toString() ?? "--"} />
          <Readout label="Latency" value={roundTripMs === null ? "--" : `${roundTripMs} ms`} />
          <Readout label="Devices" value={connectedDevices.toString()} />
        </div>

        <div className="stream-device-list" aria-label="Connected Playdate devices">
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No authenticated devices yet.</p>
          ) : (
            devices.map((device) => (
              <div className="stream-device-row text-xs" key={device.id}>
                <div>
                  <strong className="truncate">{device.id}</strong>
                  <span className="truncate text-muted-foreground">{device.address}</span>
                </div>
                <span className="truncate text-muted-foreground">rev {device.lastRevisionSent ?? "--"}</span>
                <span className="truncate text-muted-foreground">{device.packetsSent} packets</span>
              </div>
            ))
          )}
        </div>

        <div className="stream-menu-actions">
          <Button
            onClick={toggleStream}
            variant={enabled ? "secondary" : "default"}
            disabled={streamActionDisabled}
          >
            {enabled ? <Square size={16} aria-hidden /> : <RadioTower size={16} aria-hidden />}
            {enabled ? "Stop stream" : "Start stream"}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">The Playdate target is available while streaming is active.</div>
      </PopoverContent>
    </Popover>
  );
}

function createStreamId(): string {
  return `electron-${crypto.randomUUID()}`;
}

function Readout({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="stream-readout">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <strong className="truncate text-sm text-foreground">{value}</strong>
    </div>
  );
}
