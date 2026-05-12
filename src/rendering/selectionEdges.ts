import type { BinaryMaskSurface, Point } from "../domain/types";

export interface SelectionBoundaryPath {
  points: Point[];
}

interface BoundaryPoint {
  x: number;
  y: number;
}

interface BoundaryEdge {
  direction: Direction;
  end: BoundaryPoint;
  id: string;
  start: BoundaryPoint;
}

type Direction = 0 | 1 | 2 | 3;

const EAST: Direction = 0;
const SOUTH: Direction = 1;
const WEST: Direction = 2;
const NORTH: Direction = 3;
// Prefer the left-most continuation at shared vertices so diagonally touching
// selected pixels remain part of one 8-connected visual contour.
const TURN_PRIORITY = [3, 0, 1, 2] as const;
const OUTSIDE_STROKE_OFFSET = 0.5;

export function traceSelectionBoundaryPaths(mask: BinaryMaskSurface, cellSize: number): SelectionBoundaryPath[] {
  const safeCellSize = Math.max(1, Math.round(cellSize));
  const edges = createBoundaryEdges(mask);
  const outgoing = groupOutgoingEdges(edges);
  const visited = new Set<string>();
  const paths: SelectionBoundaryPath[] = [];

  for (const edge of edges) {
    if (visited.has(edge.id)) continue;
    const loop = traceEdgeLoop(edge, outgoing, visited);
    if (loop.length < 4 || !pointsEqual(loop[0].start, loop.at(-1)?.end)) continue;

    const boundaryPoints = simplifyBoundaryPoints(edgesToPoints(loop));
    const points = offsetBoundaryPoints(boundaryPoints, safeCellSize);
    if (points.length >= 3) paths.push({ points });
  }

  return paths;
}

function createBoundaryEdges(mask: BinaryMaskSurface): BoundaryEdge[] {
  const edges: BoundaryEdge[] = [];

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (!maskCell(mask, x, y)) continue;

      if (!maskCell(mask, x, y - 1)) edges.push(createBoundaryEdge(x, y, x + 1, y, EAST));
      if (!maskCell(mask, x + 1, y)) edges.push(createBoundaryEdge(x + 1, y, x + 1, y + 1, SOUTH));
      if (!maskCell(mask, x, y + 1)) edges.push(createBoundaryEdge(x + 1, y + 1, x, y + 1, WEST));
      if (!maskCell(mask, x - 1, y)) edges.push(createBoundaryEdge(x, y + 1, x, y, NORTH));
    }
  }

  return edges.sort(compareEdges);
}

function createBoundaryEdge(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  direction: Direction,
): BoundaryEdge {
  const start = { x: startX, y: startY };
  const end = { x: endX, y: endY };
  return {
    direction,
    end,
    id: `${startX},${startY}->${endX},${endY}`,
    start,
  };
}

function groupOutgoingEdges(edges: BoundaryEdge[]): Map<string, BoundaryEdge[]> {
  const outgoing = new Map<string, BoundaryEdge[]>();
  for (const edge of edges) {
    const key = pointKey(edge.start);
    const bucket = outgoing.get(key);
    if (bucket) {
      bucket.push(edge);
    } else {
      outgoing.set(key, [edge]);
    }
  }

  for (const bucket of outgoing.values()) {
    bucket.sort(compareEdges);
  }

  return outgoing;
}

function traceEdgeLoop(
  firstEdge: BoundaryEdge,
  outgoing: Map<string, BoundaryEdge[]>,
  visited: Set<string>,
): BoundaryEdge[] {
  const loop: BoundaryEdge[] = [];
  let current: BoundaryEdge | null = firstEdge;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    loop.push(current);

    if (pointsEqual(current.end, firstEdge.start)) break;

    current = chooseNextEdge(
      current,
      (outgoing.get(pointKey(current.end)) ?? []).filter((edge) => !visited.has(edge.id)),
    );
  }

  return loop;
}

function chooseNextEdge(current: BoundaryEdge, candidates: BoundaryEdge[]): BoundaryEdge | null {
  if (candidates.length === 0) return null;

  for (const turn of TURN_PRIORITY) {
    const next = candidates.find((candidate) => turnDelta(current.direction, candidate.direction) === turn);
    if (next) return next;
  }

  return candidates[0] ?? null;
}

function turnDelta(from: Direction, to: Direction): 0 | 1 | 2 | 3 {
  return ((to - from + 4) % 4) as 0 | 1 | 2 | 3;
}

function edgesToPoints(edges: BoundaryEdge[]): BoundaryPoint[] {
  return edges.map((edge) => edge.start);
}

function simplifyBoundaryPoints(points: BoundaryPoint[]): BoundaryPoint[] {
  if (points.length <= 2) return points;

  return points.filter((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    return !sameDirection(previous, point, next);
  });
}

function sameDirection(previous: BoundaryPoint, current: BoundaryPoint, next: BoundaryPoint): boolean {
  return Math.sign(current.x - previous.x) === Math.sign(next.x - current.x)
    && Math.sign(current.y - previous.y) === Math.sign(next.y - current.y);
}

function offsetBoundaryPoints(points: BoundaryPoint[], cellSize: number): Point[] {
  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const previousDirection = normalizedDirection(previous, point);
    const nextDirection = normalizedDirection(point, next);
    const previousNormal = outsideNormal(previousDirection);
    const nextNormal = outsideNormal(nextDirection);
    const current = toOverlayPoint(point, cellSize);

    const previousLine = {
      a: addPoint(toOverlayPoint(previous, cellSize), scalePoint(previousNormal, OUTSIDE_STROKE_OFFSET)),
      b: addPoint(current, scalePoint(previousNormal, OUTSIDE_STROKE_OFFSET)),
    };
    const nextLine = {
      a: addPoint(current, scalePoint(nextNormal, OUTSIDE_STROKE_OFFSET)),
      b: addPoint(toOverlayPoint(next, cellSize), scalePoint(nextNormal, OUTSIDE_STROKE_OFFSET)),
    };

    return intersectLines(previousLine.a, previousLine.b, nextLine.a, nextLine.b)
      ?? addPoint(current, scalePoint(nextNormal, OUTSIDE_STROKE_OFFSET));
  });
}

function normalizedDirection(start: BoundaryPoint, end: BoundaryPoint): Point {
  return {
    x: Math.sign(end.x - start.x),
    y: Math.sign(end.y - start.y),
  };
}

function outsideNormal(direction: Point): Point {
  return {
    x: direction.y,
    y: -direction.x,
  };
}

function toOverlayPoint(point: BoundaryPoint, cellSize: number): Point {
  return {
    x: 1 + point.x * cellSize,
    y: 1 + point.y * cellSize,
  };
}

function addPoint(left: Point, right: Point): Point {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
  };
}

function scalePoint(point: Point, scale: number): Point {
  return {
    x: point.x * scale,
    y: point.y * scale,
  };
}

function intersectLines(firstStart: Point, firstEnd: Point, secondStart: Point, secondEnd: Point): Point | null {
  const first = { x: firstEnd.x - firstStart.x, y: firstEnd.y - firstStart.y };
  const second = { x: secondEnd.x - secondStart.x, y: secondEnd.y - secondStart.y };
  const determinant = first.x * second.y - first.y * second.x;
  if (Math.abs(determinant) < Number.EPSILON) return null;

  const delta = { x: secondStart.x - firstStart.x, y: secondStart.y - firstStart.y };
  const firstScale = (delta.x * second.y - delta.y * second.x) / determinant;
  return {
    x: firstStart.x + first.x * firstScale,
    y: firstStart.y + first.y * firstScale,
  };
}

function compareEdges(left: BoundaryEdge, right: BoundaryEdge): number {
  return (
    left.start.y - right.start.y ||
    left.start.x - right.start.x ||
    left.direction - right.direction ||
    left.end.y - right.end.y ||
    left.end.x - right.end.x
  );
}

function pointKey(point: BoundaryPoint): string {
  return `${point.x},${point.y}`;
}

function pointsEqual(left: BoundaryPoint, right: BoundaryPoint | undefined): boolean {
  return right !== undefined && left.x === right.x && left.y === right.y;
}

function maskCell(mask: BinaryMaskSurface, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return false;
  return mask.data[y * mask.width + x] === 1;
}
