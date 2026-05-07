import { useCallback, useEffect, useMemo, useState } from "react";
import { RadioTower, RefreshCw, Square, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchBridgeHealth, fetchBridgeSession, sendFrameToBridge, type BridgeSession } from "../companion/client";
import type { PreviewMode } from "../export/playdateExport";
import type { PixelLayer } from "../domain/types";

interface PhysicalPreviewPanelProps {
  open: boolean;
  layers: PixelLayer[];
  previewMode: PreviewMode;
  revision: number;
}

type BridgeState = "checking" | "online" | "offline";

export function PhysicalPreviewPanel({
  open,
  layers,
  previewMode,
  revision,
}: PhysicalPreviewPanelProps): React.JSX.Element {
  const [enabled, setEnabled] = useState(false);
  const [bridgeState, setBridgeState] = useState<BridgeState>("checking");
  const [session, setSession] = useState<BridgeSession | null>(null);
  const [lastSentRevision, setLastSentRevision] = useState<number | null>(null);
  const [roundTripMs, setRoundTripMs] = useState<number | null>(null);
  const [connectedDevices, setConnectedDevices] = useState(0);
  const [statusText, setStatusText] = useState("Start the local bridge to stream to hardware.");

  const primaryHost = useMemo(() => session?.hostCandidates[0] ?? "your-computer-ip", [session]);

  const refreshSession = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const [nextSession, health] = await Promise.all([fetchBridgeSession(signal), fetchBridgeHealth(signal)]);
        setSession(nextSession);
        setConnectedDevices(health.connectedDevices);
        setBridgeState("online");
        if (!enabled) setStatusText("Bridge is ready. Start streaming when the Playdate companion is open.");
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
    if (!open) return;

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
  }, [open, refreshSession]);

  useEffect(() => {
    if (!open || !enabled) return;

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
  }, [enabled, layers, open, previewMode, revision]);

  return (
    <section className="physical-preview-panel" aria-label="Physical Playdate preview">
      <div className="physical-preview-header">
        <div>
          <h3>Physical Device</h3>
          <p>{statusText}</p>
        </div>
        <div className={`bridge-status is-${bridgeState}`}>
          <Wifi size={15} aria-hidden />
          {bridgeState === "online" ? "Bridge online" : bridgeState === "checking" ? "Checking" : "Bridge offline"}
        </div>
      </div>

      <div className="physical-preview-grid">
        <div className="connection-readout">
          <span>Session</span>
          <strong>{session?.sessionCode ?? "------"}</strong>
        </div>
        <div className="connection-readout">
          <span>Device target</span>
          <strong>
            {primaryHost}:{session?.streamPort ?? 9138}
          </strong>
        </div>
        <div className="connection-readout">
          <span>Sent revision</span>
          <strong>{lastSentRevision ?? "--"}</strong>
        </div>
        <div className="connection-readout">
          <span>Latency</span>
          <strong>{roundTripMs === null ? "--" : `${roundTripMs} ms`}</strong>
        </div>
        <div className="connection-readout">
          <span>Devices</span>
          <strong>{connectedDevices}</strong>
        </div>
      </div>

      <div className="physical-preview-actions">
        <Button onClick={() => setEnabled((current) => !current)} variant={enabled ? "secondary" : "default"}>
          {enabled ? <Square size={16} aria-hidden /> : <RadioTower size={16} aria-hidden />}
          {enabled ? "Stop stream" : "Start stream"}
        </Button>
        <Button variant="outline" onClick={() => void refreshSession()}>
          <RefreshCw size={16} aria-hidden />
          Refresh
        </Button>
      </div>

      <div className="physical-preview-setup">
        <span>Bridge</span>
        <code>npm run companion:bridge</code>
        <span>Companion app</span>
        <code>companion/playdate-preview</code>
      </div>
    </section>
  );
}
