import { useState } from "react";
import { Download, MonitorPlay, RadioTower, Square, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { openCompanionPdxInSimulator, saveCompanionPdxWithDesktopDialog } from "../desktop/desktopApi";
import { usePlaydateStream } from "../hooks/usePlaydateStream";
import { useEditorStore } from "../state/editorStore";

interface PlaydateStreamMenuProps {
  align?: "center" | "end" | "start";
  className?: string;
}

export function PlaydateStreamMenu({ align = "end", className }: PlaydateStreamMenuProps): React.JSX.Element {
  const layers = useEditorStore((state) => state.root.layers);
  const background = useEditorStore((state) => state.root.background);
  const objects = useEditorStore((state) => state.objects);
  const palette = useEditorStore((state) => state.palette);
  const documentRevision = useEditorStore((state) => state.documentRevision);
  const previewMode = useEditorStore((state) => state.previewMode);
  const stream = usePlaydateStream({ background, layers, objects, palette, previewMode, documentRevision });
  const [companionActionStatus, setCompanionActionStatus] = useState<string | null>(null);
  const [companionActionRunning, setCompanionActionRunning] = useState(false);

  const saveCompanion = async (): Promise<void> => {
    setCompanionActionRunning(true);
    setCompanionActionStatus(null);
    try {
      await saveCompanionPdxWithDesktopDialog();
    } catch (error) {
      setCompanionActionStatus(error instanceof Error ? error.message : "Unable to save companion.");
    } finally {
      setCompanionActionRunning(false);
    }
  };

  const openCompanion = async (): Promise<void> => {
    setCompanionActionRunning(true);
    setCompanionActionStatus(null);
    try {
      await openCompanionPdxInSimulator();
    } catch (error) {
      setCompanionActionStatus(error instanceof Error ? error.message : "Unable to open companion in Simulator.");
    } finally {
      setCompanionActionRunning(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className={cn(className)} variant={stream.enabled ? "secondary" : "default"}>
          <RadioTower />
          {stream.enabled ? "Streaming" : "Stream to Playdate"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="playdate-stream-menu" align={align}>
        <div className="stream-menu-header">
          <h2 className="text-sm font-medium">Playdate Stream</h2>
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
          <div className={`stream-status is-${stream.streamState}`}>
            <Wifi size={15} aria-hidden />
            {stream.streamStatusLabel}
          </div>
        </div>

        {stream.enabled ? (
          <>
            <div className="stream-readout-grid">
              <Readout label="Host" value={stream.primaryHost} />
              <Readout label="Port" value={`${stream.streamInfo?.streamPort ?? 9138}`} />
            </div>

            <div className="stream-section">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">Connected Devices</h3>
              <div className="stream-device-list" aria-label="Connected Playdate devices">
                {stream.devices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No Devices Connected</p>
                ) : (
                  stream.devices.map((device) => (
                    <div className="stream-device-row text-xs" key={device.address}>
                      <div>
                        <span className="truncate text-muted-foreground">{device.address}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}

        <div className="stream-companion-section">
          <h3 className="text-xs font-medium uppercase text-muted-foreground">PD Pixel Preview</h3>
          <div className="stream-menu-actions">
            <Button onClick={() => void openCompanion()} variant="outline" disabled={companionActionRunning}>
              <MonitorPlay size={16} aria-hidden />
              Open in Simulator
            </Button>
            <Button onClick={() => void saveCompanion()} variant="outline" disabled={companionActionRunning}>
              <Download size={16} aria-hidden />
              Save .pdx
            </Button>
          </div>
          {companionActionStatus ? <div className="text-xs text-muted-foreground">{companionActionStatus}</div> : null}
        </div>
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
