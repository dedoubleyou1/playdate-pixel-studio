import { DragOverlay, useDraggable, useDragOperation } from "@dnd-kit/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CANVAS_DROP_ID } from "../dragDropIds";
import type { ObjectDefinition } from "../domain/types";
import { useEditorStore } from "../state/editorStore";
import { ObjectPreviewCanvas } from "./ObjectPreviewCanvas";

export function ObjectLibrary(): React.JSX.Element {
  const objects = useEditorStore((state) => state.objects);
  const activeContext = useEditorStore((state) => state.activeContext);
  const addObject = useEditorStore((state) => state.addObject);
  const renameObject = useEditorStore((state) => state.renameObject);
  const switchToObject = useEditorStore((state) => state.switchToObject);
  const revision = useEditorStore((state) => state.revision);
  const { target } = useDragOperation();
  const hideDragOverlay = target?.id === CANVAS_DROP_ID;

  return (
    <div className="panel-section object-library">
      <div className="object-library-header">
        <h2>Objects</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Create object" onClick={addObject}>
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create object</TooltipContent>
        </Tooltip>
      </div>

      <div className="object-list">
        {objects.length === 0 ? (
          <p>No reusable objects yet.</p>
        ) : (
          objects.map((object) => (
            <ObjectRow
              active={activeContext.type === "object" && activeContext.objectId === object.id}
              draggable={activeContext.type === "root"}
              key={object.id}
              object={object}
              onRename={renameObject}
              onSelect={switchToObject}
              revision={revision}
            />
          ))
        )}
      </div>
      <DragOverlay className="object-drag-overlay" disabled={hideDragOverlay} dropAnimation={null}>
        {(source) => {
          const objectId = getDraggedObjectId(source.data);
          const object = objects.find((candidate) => candidate.id === objectId);
          if (!object) return null;

          const thumbnailSize = getObjectThumbnailSize(object.width, object.height, 96, 72);
          return (
            <ObjectPreviewCanvas
              className="object-thumb object-drag-preview"
              object={object}
              revision={revision}
              style={{
                height: `${thumbnailSize.height}px`,
                width: `${thumbnailSize.width}px`,
              }}
            />
          );
        }}
      </DragOverlay>
    </div>
  );
}

function ObjectRow({
  active,
  draggable,
  object,
  onRename,
  onSelect,
  revision,
}: {
  active: boolean;
  draggable: boolean;
  object: ObjectDefinition;
  onRename: (objectId: string, name: string) => void;
  onSelect: (objectId: string) => void;
  revision: number;
}): React.JSX.Element {
  const thumbnailSize = getObjectThumbnailSize(object.width, object.height);
  const { isDragging, ref: draggableRef } = useDraggable({
    id: `object:${object.id}`,
    type: "object",
    data: {
      kind: "object",
      objectId: object.id,
    },
    disabled: !draggable,
  });

  return (
    <div
      ref={draggableRef}
      className={`object-item${active ? " is-active" : ""}${isDragging ? " is-dragging" : ""}${
        draggable ? "" : " is-drag-disabled"
      }`}
      onClick={() => onSelect(object.id)}
    >
      <div className="object-thumb-frame">
        <ObjectPreviewCanvas
          className="object-thumb"
          object={object}
          revision={revision}
          style={{
            height: `${thumbnailSize.height}px`,
            width: `${thumbnailSize.width}px`,
          }}
        />
      </div>
      <Input
        className="min-w-0"
        aria-label="Object name"
        value={object.name}
        onChange={(event) => onRename(object.id, event.target.value.trim() || object.name)}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

function getObjectThumbnailSize(
  width: number,
  height: number,
  maxWidth = 56,
  maxHeight = 40,
): { width: number; height: number } {
  const scale = Math.min(maxWidth / width, maxHeight / height);

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

function getDraggedObjectId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const objectData = data as { kind?: unknown; objectId?: unknown };
  return objectData.kind === "object" && typeof objectData.objectId === "string" ? objectData.objectId : null;
}
