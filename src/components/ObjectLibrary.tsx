import { DragOverlay, useDraggable, useDragOperation } from "@dnd-kit/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CANVAS_DROP_ID } from "../dragDropIds";
import { objectThumbnailKey } from "../domain/thumbnailKeys";
import type { ObjectDefinition } from "../domain/types";
import { useEditorStore } from "../state/editorStore";
import { EditorAssetItem } from "./EditorAssetItem";
import { EditorList, EditorPane, EditorPaneTitle } from "./layout/editor-layout";
import { ObjectPreviewCanvas } from "./ObjectPreviewCanvas";

export function ObjectLibrary(): React.JSX.Element {
  const objects = useEditorStore((state) => state.objects);
  const activeContext = useEditorStore((state) => state.activeContext);
  const addObject = useEditorStore((state) => state.addObject);
  const renameObject = useEditorStore((state) => state.renameObject);
  const switchToObject = useEditorStore((state) => state.switchToObject);
  const { target } = useDragOperation();
  const hideDragOverlay = target?.id === CANVAS_DROP_ID;

  return (
    <EditorPane className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <EditorPaneTitle>Objects</EditorPaneTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Create object" onClick={addObject}>
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create object</TooltipContent>
        </Tooltip>
      </div>

      <EditorList>
        {objects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reusable objects yet.</p>
        ) : (
          objects.map((object) => (
            <ObjectRow
              active={activeContext.type === "object" && activeContext.objectId === object.id}
              draggable={activeContext.type === "root"}
              key={object.id}
              object={object}
              onRename={renameObject}
              onSelect={switchToObject}
            />
          ))
        )}
      </EditorList>
      <DragOverlay className="object-drag-overlay" disabled={hideDragOverlay} dropAnimation={null}>
        {(source) => {
          const objectId = getDraggedObjectId(source.data);
          const object = objects.find((candidate) => candidate.id === objectId);
          if (!object) return null;

          const thumbnailSize = getObjectThumbnailSize(object.width, object.height, 96, 72);
          const thumbnailKey = objectThumbnailKey(object);
          return (
            <ObjectPreviewCanvas
              canvasHeight={thumbnailSize.height}
              canvasWidth={thumbnailSize.width}
              className="object-thumb object-drag-preview"
              object={object}
              thumbnailKey={thumbnailKey}
              style={{
                height: `${thumbnailSize.height}px`,
                width: `${thumbnailSize.width}px`,
              }}
            />
          );
        }}
      </DragOverlay>
    </EditorPane>
  );
}

function ObjectRow({
  active,
  draggable,
  object,
  onRename,
  onSelect,
}: {
  active: boolean;
  draggable: boolean;
  object: ObjectDefinition;
  onRename: (objectId: string, name: string) => void;
  onSelect: (objectId: string) => void;
}): React.JSX.Element {
  const thumbnailSize = getObjectThumbnailSize(object.width, object.height);
  const thumbnailKey = objectThumbnailKey(object);
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
    <EditorAssetItem
      active={active}
      ref={draggableRef}
      className={`${draggable ? "cursor-grab" : "cursor-default"} ${isDragging ? "cursor-grabbing opacity-60" : ""}`}
      fallbackName={object.name}
      name={object.name}
      nameLabel="Object name"
      onClick={() => onSelect(object.id)}
      onRename={(name) => onRename(object.id, name)}
      thumbnail={
        <ObjectPreviewCanvas
          canvasHeight={thumbnailSize.height}
          canvasWidth={thumbnailSize.width}
          className="object-thumb"
          object={object}
          thumbnailKey={thumbnailKey}
          style={{
            height: `${thumbnailSize.height}px`,
            width: `${thumbnailSize.width}px`,
          }}
        />
      }
    />
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
