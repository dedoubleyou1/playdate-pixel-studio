import { useCallback, useState } from "react";
import { useDragDropMonitor, useDroppable } from "@dnd-kit/react";
import { CANVAS_DROP_ID } from "../dragDropIds";
import { activeStack } from "../domain/layers";
import type { ObjectDefinition } from "../domain/types";
import { useEditorStore } from "../state/editorStore";

export interface ObjectDropPreview {
  objectId: string;
  x: number;
  y: number;
}

interface CanvasDropEvent {
  nativeEvent?: Event;
  operation: {
    source?: { data?: unknown } | null;
    target?: { id?: unknown } | null;
  };
}

export function useCanvasObjectDrop(canvas: HTMLCanvasElement | null): {
  isDropTarget: boolean;
  objectDropPreview: ObjectDropPreview | null;
  previewObject: ObjectDefinition | null;
  setDropTargetRef: (element: HTMLElement | null) => void;
} {
  const [objectDropPreview, setObjectDropPreview] = useState<ObjectDropPreview | null>(null);
  const activeContext = useEditorStore((state) => state.activeContext);
  const objects = useEditorStore((state) => state.objects);
  const stack = useEditorStore((state) => activeStack(state));
  const placeObjectOnRoot = useEditorStore((state) => state.placeObjectOnRoot);
  const objectDropsEnabled = activeContext.type === "root";
  const { isDropTarget, ref: setDropTargetRef } = useDroppable({
    id: CANVAS_DROP_ID,
    accept: "object",
    type: "canvas",
    data: { kind: "canvas" },
    disabled: !objectDropsEnabled,
  });

  const getDropPreviewFromEvent = useCallback(
    (event: CanvasDropEvent) =>
      objectDropPreviewFromEvent({
        canvas,
        enabled: objectDropsEnabled,
        event,
        height: stack.height,
        objects,
        width: stack.width,
      }),
    [canvas, objectDropsEnabled, objects, stack.height, stack.width],
  );

  const previewObject = objectDropPreview
    ? objects.find((candidate) => candidate.id === objectDropPreview.objectId) ?? null
    : null;

  useDragDropMonitor({
    onDragStart() {
      setObjectDropPreview(null);
    },
    onDragMove(event) {
      const preview = getDropPreviewFromEvent(event);
      setObjectDropPreview((current) => (objectDropPreviewsEqual(current, preview) ? current : preview));
    },
    onDragEnd(event) {
      const preview = getDropPreviewFromEvent(event) ?? objectDropPreview;
      setObjectDropPreview(null);

      if (!event.canceled && preview) {
        placeObjectOnRoot(preview.objectId, { x: preview.x, y: preview.y });
      }
    },
  });

  return {
    isDropTarget,
    objectDropPreview,
    previewObject,
    setDropTargetRef,
  };
}

export function objectDropPreviewFromEvent({
  canvas,
  enabled,
  event,
  height,
  objects,
  width,
}: {
  canvas: Pick<HTMLCanvasElement, "getBoundingClientRect"> | null;
  enabled: boolean;
  event: CanvasDropEvent;
  height: number;
  objects: ObjectDefinition[];
  width: number;
}): ObjectDropPreview | null {
  if (!enabled) return null;
  if (event.operation.target?.id !== CANVAS_DROP_ID) return null;

  const objectId = draggedObjectId(event.operation.source?.data);
  const object = objects.find((candidate) => candidate.id === objectId);
  const coordinates = clientCoordinates(event.nativeEvent);
  if (!objectId || !object || !coordinates || !canvas) return null;

  const center = canvasPixelFromClient(coordinates, canvas, width, height);
  return {
    objectId,
    x: center.x - Math.floor(object.width / 2),
    y: center.y - Math.floor(object.height / 2),
  };
}

function canvasPixelFromClient(
  coordinates: { clientX: number; clientY: number },
  canvas: Pick<HTMLCanvasElement, "getBoundingClientRect">,
  width: number,
  height: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(width - 1, Math.floor(((coordinates.clientX - rect.left) / rect.width) * width))),
    y: Math.max(0, Math.min(height - 1, Math.floor(((coordinates.clientY - rect.top) / rect.height) * height))),
  };
}

function objectDropPreviewsEqual(left: ObjectDropPreview | null, right: ObjectDropPreview | null): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.objectId === right.objectId && left.x === right.x && left.y === right.y;
}

function draggedObjectId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const objectData = data as { kind?: unknown; objectId?: unknown };
  return objectData.kind === "object" && typeof objectData.objectId === "string" ? objectData.objectId : null;
}

function clientCoordinates(event: Event | undefined): { clientX: number; clientY: number } | null {
  if (event && "clientX" in event && "clientY" in event) {
    return {
      clientX: Number(event.clientX),
      clientY: Number(event.clientY),
    };
  }

  return null;
}
