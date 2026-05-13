import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RadioTower, RefreshCw, Square, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  fetchBridgeHealth,
  fetchBridgeSession,
  sendFrameToBridge,
  type BridgeDevice,
  type BridgeSession,
} from "../companion/client";
import { getDesktopBridgeStatus, restartDesktopBridge } from "../desktop/desktopApi";
import { useEditorStore } from "../state/editorStore";

type BridgeState = "checking" | "online" | "offline" | "restarting";

export function PlaydateStreamMenu(): React.JSX.Element {
  const layers = useEditorStore((state) => state.root.layers);
  const background = useEditorStore((state) => state.root.background);
  const objects = useEditorStore((state) => state.objects);
  const palette = useEditorStore((state) => state.palette);
  const documentRevision = useEditorStore((state) => state.documentRevision);
  const previewMode = useEditorStore((state) => state.previewMode);
  const [enabled, setEnabled] = useState(false);
  const [bridgeState, setBridgeState] = useState<BridgeState>("checking");
  const [session, setSession] = useState<BridgeSession | null>(null);
  const [lastSentRevision, setLastSentRevision] = useState<number | null>(null);
  const [roundTripMs, setRoundTripMs] = useState<number | null>(null);
  const [connectedDevices, setConnectedDevices] = useState(0);
  const [devices, setDevices] = useState<BridgeDevice[]>([]);
  const [restartInFlight, setRestartInFlight] = useState(false);
  const [statusText, setStatusText] = useState("Connect the companion, then stream.");
  const latestFrameRef = useRef({ background, layers, objects, palette, previewMode, documentRevision });
  const lastPostedRevisionRef = useRef<number | null>(null);
  const sendInFlightRef = useRef(false);
  const streamRunIdRef = useRef(0);

  const primaryHost = useMemo(() => session?.hostCandidates[0] ?? "your-computer-ip", [session]);
  const bridgeStatusLabel =
    bridgeState === "online" ? "Online" : bridgeState === "restarting" ? "Restarting" : bridgeState === "checking" ? "Checking" : "Offline";

  useEffect(() => {
    latestFrameRef.current = { background, layers, objects, palette, previewMode, documentRevision };
  }, [background, layers, objects, palette, previewMode, documentRevision]);

  const refreshSession = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const [nextSession, health] = await Promise.all([fetchBridgeSession(signal), fetchBridgeHealth(signal)]);
        setSession(nextSession);
        setConnectedDevices(health.connectedDevices);
        setDevices(nextSession.devices ?? []);
        setBridgeState("online");
        if (!enabled) {
          setStatusText("Built-in bridge ready. Stream when the companion says waiting for frames.");
        }
      } catch {
        if (!signal?.aborted) {
          const desktopStatus = await getDesktopBridgeStatus().catch(() => null);
          setBridgeState(desktopStatus?.restarting ? "restarting" : "offline");
          setConnectedDevices(0);
          setDevices([]);
          setSession(null);
          if (!enabled) {
            if (desktopStatus?.restarting) setStatusText("Built-in bridge is restarting.");
            else if (desktopStatus && !desktopStatus.ok) {
              setStatusText(`Built-in bridge failed to start: ${desktopStatus.error ?? "unknown error"}.`);
            } else if (desktopStatus?.running) setStatusText("Built-in bridge is starting.");
            else setStatusText("Built-in bridge is offline.");
          }
        }
      }
    },
    [enabled],
  );

  const restartBridge = useCallback(async (): Promise<void> => {
    try {
      setRestartInFlight(true);
      setEnabled(false);
      setBridgeState("restarting");
      setStatusText("Restarting built-in bridge.");
      await restartDesktopBridge();
      await refreshSession();
    } catch (error) {
      setBridgeState("offline");
      setStatusText(error instanceof Error ? error.message : "Unable to restart the built-in bridge.");
    } finally {
      setRestartInFlight(false);
    }
  }, [refreshSession]);

  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => {
      void refreshSession(controller.signal);
    }, 0);
    const interval = window.setInterval(() => {
      void refreshSession(controller.signal);
    }, 3000);

    return () => {
      controller.abort();
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const runId = streamRunIdRef.current + 1;
    const streamId = createStreamId();
    streamRunIdRef.current = runId;
    lastPostedRevisionRef.current = null;

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
          if (controller.signal.aborted) return;
          setBridgeState("online");
          lastPostedRevisionRef.current = result.revision;
          setLastSentRevision(result.revision);
          setRoundTripMs(result.roundTripMs);
          setStatusText(
            `Streaming document revision ${result.revision} (${result.byteLength.toLocaleString()} bytes).`,
          );
          void refreshSession();
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

    sendLatestFrame();
    const interval = window.setInterval(sendLatestFrame, 100);

    return () => {
      controller.abort();
      streamRunIdRef.current += 1;
      window.clearInterval(interval);
      sendInFlightRef.current = false;
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
          <Readout label="Bridge" value="Built-in" />
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
          <Button onClick={() => setEnabled((current) => !current)} variant={enabled ? "secondary" : "default"}>
            {enabled ? <Square size={16} aria-hidden /> : <RadioTower size={16} aria-hidden />}
            {enabled ? "Stop stream" : "Start stream"}
          </Button>
          <Button variant="outline" onClick={() => void refreshSession()}>
            <RefreshCw size={16} aria-hidden />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => void restartBridge()} disabled={restartInFlight}>
            <RefreshCw size={16} aria-hidden />
            Restart bridge
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">Closing this menu does not stop an active stream.</div>
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
