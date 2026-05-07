import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import type { PixelLayer } from "../domain/types";
import { composeImageData } from "../rendering/compositor";
import type { PlaydateProjectDocument } from "../persistence/projectSchema";

export type PreviewMode = "normal" | "inverted" | "lcd";

export interface SpriteSheetMetadata {
  width: number;
  height: number;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  format: "1-bit-png";
  target: "playdate";
}

export function createPlaydatePngCanvas(layers: PixelLayer[], mode: PreviewMode = "normal"): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = PLAYDATE_WIDTH;
  canvas.height = PLAYDATE_HEIGHT;
  const context = requireContext(canvas);
  const image = composeImageData(layers, (width, height) => context.createImageData(width, height), { device: true });
  applyPreviewMode(image, mode);
  context.putImageData(image, 0, 0);
  return canvas;
}

export function createSpriteSheetMetadata(): SpriteSheetMetadata {
  return {
    width: PLAYDATE_WIDTH,
    height: PLAYDATE_HEIGHT,
    frames: 1,
    frameWidth: PLAYDATE_WIDTH,
    frameHeight: PLAYDATE_HEIGHT,
    format: "1-bit-png",
    target: "playdate",
  };
}

export async function createProjectBundle(document: PlaydateProjectDocument, layers: PixelLayer[]): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const pngCanvas = createPlaydatePngCanvas(layers);
  const pngBlob = await canvasToBlob(pngCanvas);
  zip.file("project.playdate-pixel.json", JSON.stringify(document, null, 2));
  zip.file("exports/screen.png", pngBlob);
  zip.file("exports/screen.metadata.json", JSON.stringify(createSpriteSheetMetadata(), null, 2));
  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Unable to export canvas.");
  return blob;
}

export function applyPreviewMode(image: ImageData, mode: PreviewMode): void {
  if (mode === "normal") return;

  for (let index = 0; index < image.data.length; index += 4) {
    if (mode === "inverted") {
      image.data[index] = 255 - image.data[index];
      image.data[index + 1] = 255 - image.data[index + 1];
      image.data[index + 2] = 255 - image.data[index + 2];
    }

    if (mode === "lcd" && image.data[index] === 255) {
      image.data[index] = 202;
      image.data[index + 1] = 207;
      image.data[index + 2] = 190;
    }
  }
}

function requireContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");
  return context;
}
