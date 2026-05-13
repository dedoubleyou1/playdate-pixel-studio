import { RadioTower, Square, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePlaydateStream } from "../hooks/usePlaydateStream";
import { useEditorStore } from "../state/editorStore";

export function PlaydateStreamMenu(): React.JSX.Element {
  const layers = useEditorStore((state) => state.root.layers);
  const background = useEditorStore((state) => state.root.background);
  const objects = useEditorStore((state) => state.objects);
  const palette = useEditorStore((state) => state.palette);
  const documentRevision = useEditorStore((state) => state.documentRevision);
  const previewMode = useEditorStore((state) => state.previewMode);
  const stream = usePlaydateStream({ background, layers, objects, palette, previewMode, documentRevision });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={stream.enabled ? "secondary" : "default"}>
          <RadioTower />
          {stream.enabled ? "Streaming" : "Stream to Playdate"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="playdate-stream-menu" align="end">
        <div className="stream-menu-header">
          <div>
            <h2 className="text-sm font-medium">Playdate Stream</h2>
            <p className="mt-1 text-xs text-muted-foreground">{stream.statusText}</p>
          </div>
          <div className={`stream-status is-${stream.streamState}`}>
            <Wifi size={15} aria-hidden />
            {stream.streamStatusLabel}
          </div>
        </div>

        <div className="stream-readout-grid">
          <Readout label="Session" value={stream.session?.sessionCode ?? "------"} />
          <Readout label="Target" value={`${stream.primaryHost}:${stream.session?.streamPort ?? 9138}`} />
          <Readout label="Revision" value={stream.lastSentRevision?.toString() ?? "--"} />
          <Readout label="Latency" value={stream.roundTripMs === null ? "--" : `${stream.roundTripMs} ms`} />
          <Readout label="Devices" value={stream.connectedDevices.toString()} />
        </div>

        <div className="stream-device-list" aria-label="Connected Playdate devices">
          {stream.devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No authenticated devices yet.</p>
          ) : (
            stream.devices.map((device) => (
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
            onClick={stream.toggleStream}
            variant={stream.enabled ? "secondary" : "default"}
            disabled={stream.streamActionDisabled}
          >
            {stream.enabled ? <Square size={16} aria-hidden /> : <RadioTower size={16} aria-hidden />}
            {stream.enabled ? "Stop stream" : "Start stream"}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">The Playdate target is available while streaming is active.</div>
      </PopoverContent>
    </Popover>
  );
}

function Readout({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="stream-readout">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <strong className="truncate text-sm text-foreground">{value}</strong>
    </div>
  );
}
