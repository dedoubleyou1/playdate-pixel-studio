import type { BrushShape } from "./types";

export function brushShapeContains(shape: BrushShape, size: number, x: number, y: number): boolean {
  if (shape === "square") return true;

  const safeSize = Math.max(1, Math.floor(size));
  if (safeSize <= 1) return true;

  const center = (safeSize - 1) / 2;
  const radius = safeSize % 2 === 0 ? safeSize / 2 : (safeSize - 1) / 2 + 0.001;
  const dx = x - center;
  const dy = y - center;
  return dx * dx + dy * dy <= radius * radius;
}
