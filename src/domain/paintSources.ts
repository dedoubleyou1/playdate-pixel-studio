import { BLACK_PIXEL, TRANSPARENT_PIXEL, type PixelValue, type Point } from "./types";

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
