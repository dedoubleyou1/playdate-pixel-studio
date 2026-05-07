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
import { useEditorStore } from "../state/editorStore";

type BridgeState = "checking" | "online" | "offline";

export function PlaydateStreamMenu(): React.JSX.Element {
  const layers = useEditorStore((state) => state.root.layers);
  const background = useEditorStore((state) => state.root.background);
  const objects = useEditorStore((state) => state.objects);
  const revision = useEditorStore((state) => state.revision);
  const previewMode = useEditorStore((state) => state.previewMode);
  const [enabled, setEnabled] = useState(false);
  const [bridgeState, setBridgeState] = useState<BridgeState>("checking");
  const [session, setSession] = useState<BridgeSession | null>(null);
  const [lastSentRevision, setLastSentRevision] = useState<number | null>(null);
  const [roundTripMs, setRoundTripMs] = useState<number | null>(null);
  const [connectedDevices, setConnectedDevices] = useState(0);
  const [devices, setDevices] = useState<BridgeDevice[]>([]);
  const [statusText, setStatusText] = useState("Start the bridge, connect the companion, then stream.");
  const latestFrameRef = useRef({ background, layers, objects, previewMode, revision });
  const lastPostedRevisionRef = useRef<number | null>(null);
  const sendInFlightRef = useRef(false);
  const streamRunIdRef = useRef(0);

  const primaryHost = useMemo(() => session?.hostCandidates[0] ?? "your-computer-ip", [session]);

  useEffect(() => {
    latestFrameRef.current = { background, layers, objects, previewMode, revision };
  }, [background, layers, objects, previewMode, revision]);

  const refreshSession = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const [nextSession, health] = await Promise.all([fetchBridgeSession(signal), fetchBridgeHealth(signal)]);
        setSession(nextSession);
        setConnectedDevices(health.connectedDevices);
        setDevices(nextSession.devices ?? []);
        setBridgeState("online");
        if (!enabled) setStatusText("Bridge ready. Stream when the companion says waiting for frames.");
      } catch {
        if (!signal?.aborted) {
          setBridgeState("offline");
          setConnectedDevices(0);
          setDevices([]);
          setSession(null);
          if (!enabled) setStatusText("Bridge offline. Run npm run companion:bridge.");
        }
      }
    },
    [enabled],
  );

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
    streamRunIdRef.current = runId;
    lastPostedRevisionRef.current = null;

    const sendLatestFrame = () => {
      if (controller.signal.aborted || streamRunIdRef.current !== runId || sendInFlightRef.current) return;

      const frame = latestFrameRef.current;
      if (frame.revision === lastPostedRevisionRef.current) return;

      sendInFlightRef.current = true;
      void sendFrameToBridge(
        frame.layers,
        frame.previewMode,
        frame.revision,
        frame.objects,
        frame.background,
        controller.signal,
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          setBridgeState("online");
          lastPostedRevisionRef.current = result.revision;
          setLastSentRevision(result.revision);
          setRoundTripMs(result.roundTripMs);
          setStatusText(`Streaming revision ${result.revision} (${result.byteLength.toLocaleString()} bytes).`);
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
        <Button className="playdate-stream-trigger" variant={enabled ? "secondary" : "default"}>
          <RadioTower />
          {enabled ? "Streaming" : "Stream to Playdate"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="playdate-stream-menu" align="end">
        <div className="stream-menu-header">
          <div>
            <h2>Playdate Stream</h2>
            <p>{statusText}</p>
          </div>
          <div className={`bridge-status is-${bridgeState}`}>
            <Wifi size={15} aria-hidden />
            {bridgeState === "online" ? "Online" : bridgeState === "checking" ? "Checking" : "Offline"}
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
            <p>No authenticated devices yet.</p>
          ) : (
            devices.map((device) => (
              <div className="stream-device-row" key={device.id}>
                <div>
                  <strong>{device.id}</strong>
                  <span>{device.address}</span>
                </div>
                <span>rev {device.lastRevisionSent ?? "--"}</span>
                <span>{device.packetsSent} packets</span>
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
        </div>

        <div className="stream-menu-footnote">Closing this menu does not stop an active stream.</div>
      </PopoverContent>
    </Popover>
  );
}

function Readout({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="stream-readout">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
