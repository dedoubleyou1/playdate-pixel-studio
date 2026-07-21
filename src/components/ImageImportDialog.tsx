import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createDefaultImageImportMapping,
  createMappedImageImportSurface,
  prepareExactImageImport,
  prepareSegmentedImageImport,
  type DecodedImportImage,
  type ImageImportMapping,
  type ImageImportMode,
  type PreparedImageImport,
} from "../domain/imageImport";
import { paletteEntryLabel, resolveSwatchPreviewColorAtSamplePoint } from "../domain/palette";
import { useEditorStore } from "../state/editorStore";
import type { PaletteEntry, ProjectPalette } from "../domain/types";

type ImportState =
  | { status: "idle" }
  | { status: "error"; fileKey: string; message: string }
  | { status: "ready"; decoded: DecodedImportImage; fileKey: string };

export function ImageImportDialog(): React.JSX.Element {
  const pendingFile = useEditorStore((state) => state.pendingImageImportFile);
  const clearPendingImageImportFile = useEditorStore((state) => state.clearPendingImageImportFile);
  const commitImageImport = useEditorStore((state) => state.commitImageImport);
  const palette = useEditorStore((state) => state.palette);
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [modeState, setModeState] = useState<{ fileKey: string; mode: ImageImportMode }>({
    fileKey: "",
    mode: "exact",
  });
  const [mappingState, setMappingState] = useState<{ fileKey: string; mapping: ImageImportMapping }>({
    fileKey: "",
    mapping: {},
  });
  const fileKey = pendingFile ? `${pendingFile.fileName}:${pendingFile.mimeType}:${pendingFile.data.byteLength}` : "";
  const mode = modeState.fileKey === fileKey ? modeState.mode : "exact";
  const decoded = importState.status === "ready" && importState.fileKey === fileKey ? importState.decoded : null;
  const loadError = importState.status === "error" && importState.fileKey === fileKey ? importState.message : null;

  useEffect(() => {
    if (!pendingFile) return;

    let cancelled = false;
    const nextFileKey = `${pendingFile.fileName}:${pendingFile.mimeType}:${pendingFile.data.byteLength}`;

    void decodeImportImage(pendingFile)
      .then((decoded) => {
        if (!cancelled) setImportState({ status: "ready", decoded, fileKey: nextFileKey });
      })
      .catch(() => {
        if (!cancelled)
          setImportState({ status: "error", fileKey: nextFileKey, message: "Unable to decode image file." });
      });

    return () => {
      cancelled = true;
    };
  }, [pendingFile]);

  const preparation = useMemo((): { prepared: PreparedImageImport | null; prepareError: string | null } => {
    if (!decoded) return { prepared: null, prepareError: null };
    if (mode === "exact") {
      const result = prepareExactImageImport(decoded);
      if (!result.ok) {
        return { prepared: null, prepareError: rejectionMessage(result.rejection) };
      }
      return { prepared: result.import, prepareError: null };
    }

    return { prepared: prepareSegmentedImageImport(decoded), prepareError: null };
  }, [decoded, mode]);
  const prepared = preparation.prepared;
  const prepareError = preparation.prepareError;
  const defaultMapping = useMemo(
    () => (prepared ? createDefaultImageImportMapping(prepared, palette) : {}),
    [palette, prepared],
  );
  const mapping = useMemo(
    () => ({ ...defaultMapping, ...(mappingState.fileKey === fileKey ? mappingState.mapping : {}) }),
    [defaultMapping, fileKey, mappingState],
  );
  const loading = Boolean(pendingFile && !decoded && !loadError);

  const open = Boolean(pendingFile);
  const title = pendingFile ? `Import ${pendingFile.fileName}` : "Import Image";
  const closeImport = () => {
    setMappingState({ fileKey: "", mapping: {} });
    clearPendingImageImportFile();
  };
  const setImportMode = (nextMode: ImageImportMode) => {
    setModeState({ fileKey, mode: nextMode });
    setMappingState({ fileKey, mapping: {} });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? undefined : closeImport())}>
      <DialogContent className="max-h-[min(760px,calc(100vh-2rem))] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Map source colors or segments to the current dither palette.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Button variant={mode === "exact" ? "default" : "outline"} onClick={() => setImportMode("exact")}>
              <ImagePlus />
              1:1 Color Map
            </Button>
            <Button variant={mode === "segment" ? "default" : "outline"} onClick={() => setImportMode("segment")}>
              <ImagePlus />
              Auto Segment
            </Button>
          </div>

          {loading ? <p className="text-sm text-muted-foreground">Loading image...</p> : null}
          {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
          {prepareError ? (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
              <p className="text-sm text-muted-foreground">{prepareError}</p>
              <Button variant="outline" onClick={() => setImportMode("segment")}>
                Use Auto Segment
              </Button>
            </div>
          ) : null}

          {decoded && prepared ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <ImagePreviewCanvas title="Source" decoded={decoded} />
                <MappedPreviewCanvas title="Mapped" mapping={mapping} palette={palette} prepared={prepared} />
              </div>
              <MappingTable
                entries={prepared.entries}
                mapping={mapping}
                onChange={(entryId, ref) =>
                  setMappingState((current) => ({
                    fileKey,
                    mapping: {
                      ...(current.fileKey === fileKey ? current.mapping : {}),
                      [entryId]: ref,
                    },
                  }))
                }
                palette={palette}
              />
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeImport}>
            Cancel
          </Button>
          <Button
            disabled={!prepared}
            onClick={() => {
              if (!pendingFile || !prepared) return;
              commitImageImport({ fileName: pendingFile.fileName, mapping, prepared });
            }}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MappingTable({
  entries,
  mapping,
  onChange,
  palette,
}: {
  entries: PreparedImageImport["entries"];
  mapping: ImageImportMapping;
  onChange: (entryId: string, ref: number) => void;
  palette: ProjectPalette;
}): React.JSX.Element {
  const options = useMemo(
    () => palette.entries.map((entry) => ({ entry, label: paletteEntryLabel(palette, entry.ref) })),
    [palette],
  );

  return (
    <div className="max-h-80 overflow-y-auto rounded-md border border-border">
      <div className="grid grid-cols-[minmax(8rem,1fr)_5rem_minmax(11rem,14rem)] gap-3 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
        <span>Source</span>
        <span>Pixels</span>
        <span>Swatch</span>
      </div>
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="grid grid-cols-[minmax(8rem,1fr)_5rem_minmax(11rem,14rem)] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
        >
          <div className="flex min-w-0 items-center gap-2">
            <ColorChip color={entry.representativeColor} />
            <span className="truncate text-sm">
              {entry.kind === "transparent" ? "Transparent" : entry.kind === "segment" ? "Segment" : colorLabel(entry)}
            </span>
          </div>
          <span className="text-sm text-muted-foreground">{entry.pixelCount}</span>
          <Select value={String(mapping[entry.id] ?? 0)} onValueChange={(value) => onChange(entry.id, Number(value))}>
            <SelectTrigger className="w-full" aria-label={`Map ${entry.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(({ entry: paletteEntry, label }) => (
                <SelectItem key={paletteEntry.id} value={String(paletteEntry.ref)} textValue={label}>
                  <span className="flex items-center gap-2">
                    <PaletteSwatch entry={paletteEntry} palette={palette} />
                    {label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

function ImagePreviewCanvas({ decoded, title }: { decoded: DecodedImportImage; title: string }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    context.putImageData(new ImageData(new Uint8ClampedArray(decoded.pixels), decoded.width, decoded.height), 0, 0);
  }, [decoded]);

  return <PreviewFrame canvasRef={canvasRef} height={decoded.height} title={title} width={decoded.width} />;
}

function MappedPreviewCanvas({
  mapping,
  palette,
  prepared,
  title,
}: {
  mapping: ImageImportMapping;
  palette: ProjectPalette;
  prepared: PreparedImageImport;
  title: string;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const surface = createMappedImageImportSurface(prepared, mapping);
    const image = context.createImageData(surface.width, surface.height);
    for (let y = 0; y < surface.height; y += 1) {
      for (let x = 0; x < surface.width; x += 1) {
        const index = y * surface.width + x;
        const offset = index * 4;
        const color = resolveSwatchPreviewColorAtSamplePoint(
          palette,
          surface.data[index],
          { x, y },
          { colorizedPatterns: true },
        );
        image.data[offset] = color?.r ?? 192;
        image.data[offset + 1] = color?.g ?? 192;
        image.data[offset + 2] = color?.b ?? 192;
        image.data[offset + 3] = color ? 255 : 96;
      }
    }
    canvas.width = surface.width;
    canvas.height = surface.height;
    context.putImageData(image, 0, 0);
  }, [mapping, palette, prepared]);

  return <PreviewFrame canvasRef={canvasRef} height={prepared.height} title={title} width={prepared.width} />;
}

function PreviewFrame({
  canvasRef,
  height,
  title,
  width,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  height: number;
  title: string;
  width: number;
}): React.JSX.Element {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">
          {width} x {height}
        </span>
      </div>
      <div className="grid min-h-48 place-items-center overflow-auto rounded-md border border-border bg-muted/30 p-3">
        <canvas ref={canvasRef} className="max-h-72 max-w-full" style={{ imageRendering: "pixelated" }} />
      </div>
    </div>
  );
}

function ColorChip({ color }: { color: { r: number; g: number; b: number } | null }): React.JSX.Element {
  return (
    <span
      className="size-5 shrink-0 rounded-sm border border-border"
      style={{ backgroundColor: color ? `rgb(${color.r}, ${color.g}, ${color.b})` : "transparent" }}
    />
  );
}

function PaletteSwatch({ entry, palette }: { entry: PaletteEntry; palette: ProjectPalette }): React.JSX.Element {
  const color = resolveSwatchPreviewColorAtSamplePoint(palette, entry.ref, { x: 0, y: 0 }, { colorizedPatterns: true });
  return (
    <span
      className="size-4 shrink-0 rounded-sm border border-border"
      style={{ backgroundColor: color ? `rgb(${color.r}, ${color.g}, ${color.b})` : "transparent" }}
    />
  );
}

function colorLabel(entry: PreparedImageImport["entries"][number]): string {
  const color = entry.representativeColor;
  if (!color) return "Transparent";
  return `#${color.r.toString(16).padStart(2, "0")}${color.g.toString(16).padStart(2, "0")}${color.b
    .toString(16)
    .padStart(2, "0")}`;
}

function rejectionMessage(rejection: {
  reason: string;
  colorCount?: number;
  height?: number;
  limit?: number;
  width?: number;
}): string {
  if (rejection.reason === "too-large") {
    return `1:1 import requires images up to ${rejection.limit} x ${rejection.limit}. This image is ${rejection.width} x ${rejection.height}.`;
  }
  if (rejection.reason === "too-many-colors") {
    return `1:1 import supports up to ${rejection.limit} exact colors. This image has at least ${rejection.colorCount}.`;
  }
  return "This image has no importable pixels.";
}

async function decodeImportImage(file: {
  data: ArrayBuffer;
  fileName: string;
  mimeType: string;
}): Promise<DecodedImportImage> {
  const blob = new Blob([file.data], { type: file.mimeType });
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");
  context.imageSmoothingEnabled = false;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return {
    fileName: file.fileName,
    height: canvas.height,
    mimeType: file.mimeType,
    pixels: image.data,
    width: canvas.width,
  };
}
