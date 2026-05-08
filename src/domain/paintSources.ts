import { BLACK_PIXEL, TRANSPARENT_PIXEL, type PixelValue, type Point } from "./types";

export type PaintMode =
  | {
      type: "solid";
      value: PixelValue;
    }
  | {
      type: "checker-dither";
      background: PixelValue;
      foreground: PixelValue;
    };

export type PaintSource =
  | {
      id: string;
      type: "solid";
      value: PixelValue;
      pixelAt: (point: Point) => PixelValue;
    }
  | {
      id: string;
      type: "pattern";
      pixelAt: (point: Point) => PixelValue;
    };

export interface CheckerDitherPaintOptions {
  background?: PixelValue;
  foreground?: PixelValue;
}

export function solidPaintMode(value: PixelValue): PaintMode {
  return { type: "solid", value };
}

export function checkerDitherPaintMode(options: CheckerDitherPaintOptions = {}): PaintMode {
  return {
    type: "checker-dither",
    foreground: options.foreground ?? BLACK_PIXEL,
    background: options.background ?? TRANSPARENT_PIXEL,
  };
}

export function paintSourceFromMode(mode: PaintMode): PaintSource {
  if (mode.type === "checker-dither") {
    return checkerDitherPaint({ foreground: mode.foreground, background: mode.background });
  }
  return solidPaint(mode.value);
}

export function paintModeForeground(mode: PaintMode): PixelValue {
  return mode.type === "checker-dither" ? mode.foreground : mode.value;
}

export function withPaintModeForeground(mode: PaintMode, foreground: PixelValue): PaintMode {
  if (mode.type === "checker-dither") {
    return { ...mode, foreground };
  }
  return solidPaintMode(foreground);
}

export function solidPaint(value: PixelValue): PaintSource {
  return {
    id: `solid:${value}`,
    type: "solid",
    value,
    pixelAt: () => value,
  };
}

export function checkerDitherPaint(options: CheckerDitherPaintOptions = {}): PaintSource {
  const foreground = options.foreground ?? BLACK_PIXEL;
  const background = options.background ?? TRANSPARENT_PIXEL;

  return {
    id: `checker:${foreground}:${background}`,
    type: "pattern",
    pixelAt: (point) => ((point.x + point.y) % 2 === 0 ? foreground : background),
  };
}

export function paintValueAt(source: PaintSource, point: Point): PixelValue {
  return source.pixelAt(point);
}
