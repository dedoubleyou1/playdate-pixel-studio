import { DragOverlay, useDraggable, useDragOperation } from "@dnd-kit/react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CANVAS_DROP_ID } from "../dragDropIds";
import { projectPaletteKey } from "../domain/palette";
import { objectThumbnailKey } from "../domain/thumbnailKeys";
import type { ObjectDefinition, ProjectPalette } from "../domain/types";
import { useEditorStore } from "../state/editorStore";
import { EditorAssetItem } from "./EditorAssetItem";
import { EditorList, EditorPane, EditorPaneTitle } from "./layout/editor-layout";
import { ObjectPreviewCanvas } from "./ObjectPreviewCanvas";

export function ObjectLibrary(): React.JSX.Element {
  const objects = useEditorStore((state) => state.objects);
  const palette = useEditorStore((state) => state.palette);
  const activeContext = useEditorStore((state) => state.activeContext);
  const addObject = useEditorStore((state) => state.addObject);
  const deleteObject = useEditorStore((state) => state.deleteObject);
  const duplicateObject = useEditorStore((state) => state.duplicateObject);
  const renameObject = useEditorStore((state) => state.renameObject);
  const switchToObject = useEditorStore((state) => state.switchToObject);
  const { target } = useDragOperation();
  const hideDragOverlay = target?.id === CANVAS_DROP_ID;
  const activeObject = activeContext.type === "object"
    ? objects.find((object) => object.id === activeContext.objectId)
    : null;

  return (
    <EditorPane className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <EditorPaneTitle>Objects</EditorPaneTitle>
        <div className="flex items-center gap-2">
          <ObjectAction label="Create object" onClick={addObject}>
            <Plus />
          </ObjectAction>
          <ObjectAction
            label={activeObject ? `Duplicate ${activeObject.name}` : "Duplicate object"}
            disabled={!activeObject}
            onClick={() => {
              if (activeObject) duplicateObject(activeObject.id);
            }}
          >
            <Copy />
          </ObjectAction>
          <ObjectAction
            label={activeObject ? `Remove ${activeObject.name}` : "Remove object"}
            disabled={!activeObject}
            onClick={() => {
              if (activeObject) deleteObject(activeObject.id);
            }}
          >
            <Trash2 />
          </ObjectAction>
        </div>
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
              palette={palette}
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
          const thumbnailKey = `${objectThumbnailKey(object)}:${projectPaletteKey(palette)}`;
          return (
            <ObjectPreviewCanvas
              canvasHeight={thumbnailSize.height}
              canvasWidth={thumbnailSize.width}
              className="object-thumb object-drag-preview"
              object={object}
              palette={palette}
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
  palette,
  onRename,
  onSelect,
}: {
  active: boolean;
  draggable: boolean;
  object: ObjectDefinition;
  palette: ProjectPalette;
  onRename: (objectId: string, name: string) => void;
  onSelect: (objectId: string) => void;
}): React.JSX.Element {
  const thumbnailSize = getObjectThumbnailSize(object.width, object.height);
  const thumbnailKey = `${objectThumbnailKey(object)}:${projectPaletteKey(palette)}`;
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
          palette={palette}
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

function ObjectAction({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
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
