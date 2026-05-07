import { useCallback, useEffect, useMemo, useState } from "react";
import { RadioTower, RefreshCw, Square, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchBridgeHealth, fetchBridgeSession, sendFrameToBridge, type BridgeSession } from "../companion/client";
import { useEditorStore } from "../state/editorStore";

type BridgeState = "checking" | "online" | "offline";

export function PlaydateStreamMenu(): React.JSX.Element {
  const layers = useEditorStore((state) => state.layers);
  const revision = useEditorStore((state) => state.revision);
  const previewMode = useEditorStore((state) => state.previewMode);
  const [enabled, setEnabled] = useState(false);
  const [bridgeState, setBridgeState] = useState<BridgeState>("checking");
  const [session, setSession] = useState<BridgeSession | null>(null);
  const [lastSentRevision, setLastSentRevision] = useState<number | null>(null);
  const [roundTripMs, setRoundTripMs] = useState<number | null>(null);
  const [connectedDevices, setConnectedDevices] = useState(0);
  const [statusText, setStatusText] = useState("Start the bridge, connect the companion, then stream.");

  const primaryHost = useMemo(() => session?.hostCandidates[0] ?? "your-computer-ip", [session]);

  const refreshSession = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const [nextSession, health] = await Promise.all([fetchBridgeSession(signal), fetchBridgeHealth(signal)]);
        setSession(nextSession);
        setConnectedDevices(health.connectedDevices);
        setBridgeState("online");
        if (!enabled) setStatusText("Bridge ready. Stream when the companion says waiting for frames.");
      } catch {
        if (!signal?.aborted) {
          setBridgeState("offline");
          setConnectedDevices(0);
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
    const timeout = window.setTimeout(() => {
      void sendFrameToBridge(layers, previewMode, revision, controller.signal)
        .then((result) => {
          setBridgeState("online");
          setLastSentRevision(result.revision);
          setRoundTripMs(result.roundTripMs);
          setStatusText(`Streaming revision ${result.revision} (${result.byteLength.toLocaleString()} bytes).`);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setBridgeState("offline");
          setStatusText(error instanceof Error ? error.message : "Unable to stream to the bridge.");
        });
    }, 100);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [enabled, layers, previewMode, revision]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={enabled ? "secondary" : "default"}>
          <RadioTower />
          {enabled ? "Streaming" : "Playdate Stream"}
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
