import { DragOverlay, useDraggable, useDragOperation } from "@dnd-kit/react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CANVAS_DROP_ID } from "../dragDropIds";
import { useEditorStore } from "../state/editorStore";
import { EditorAssetItem } from "./EditorAssetItem";
import { EditorList, EditorPane, EditorPaneTitle } from "./layout/editor-layout";
import { ObjectPreviewCanvas } from "./ObjectPreviewCanvas";
import {
  areObjectLibraryModelsEqual,
  selectObjectLibraryModel,
  type ObjectLibraryObjectMeta,
} from "./panelSelectors";

export function ObjectLibrary(): React.JSX.Element {
  const model = useStoreWithEqualityFn(useEditorStore, selectObjectLibraryModel, areObjectLibraryModelsEqual);
  const addObject = useEditorStore((state) => state.addObject);
  const deleteObject = useEditorStore((state) => state.deleteObject);
  const duplicateObject = useEditorStore((state) => state.duplicateObject);
  const renameObject = useEditorStore((state) => state.renameObject);
  const switchToObject = useEditorStore((state) => state.switchToObject);
  const { target } = useDragOperation();
  const hideDragOverlay = target?.id === CANVAS_DROP_ID;

  return (
    <EditorPane className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <EditorPaneTitle>Objects</EditorPaneTitle>
        <div className="flex items-center gap-2">
          <ObjectAction label="Create object" onClick={addObject}>
            <Plus />
          </ObjectAction>
          <ObjectAction
            label={model.activeObjectName ? `Duplicate ${model.activeObjectName}` : "Duplicate object"}
            disabled={!model.activeObjectId}
            onClick={() => {
              if (model.activeObjectId) duplicateObject(model.activeObjectId);
            }}
          >
            <Copy />
          </ObjectAction>
          <ObjectAction
            label={model.activeObjectName ? `Remove ${model.activeObjectName}` : "Remove object"}
            disabled={!model.activeObjectId}
            onClick={() => {
              if (model.activeObjectId) deleteObject(model.activeObjectId);
            }}
          >
            <Trash2 />
          </ObjectAction>
        </div>
      </div>

      <EditorList>
        {model.objects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reusable objects yet.</p>
        ) : (
          model.objects.map((object) => (
            <ObjectRow
              active={model.activeObjectId === object.id}
              draggable={model.draggable}
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
          const object = model.objects.find((candidate) => candidate.id === objectId);
          if (!object) return null;

          const thumbnailSize = getObjectThumbnailSize(object.width, object.height, 96, 72);
          return (
            <ObjectPreviewCanvas
              canvasHeight={thumbnailSize.height}
              canvasWidth={thumbnailSize.width}
              className="object-thumb object-drag-preview"
              objectId={object.id}
              objectName={object.name}
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
  object: ObjectLibraryObjectMeta;
  onRename: (objectId: string, name: string) => void;
  onSelect: (objectId: string) => void;
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
          objectId={object.id}
          objectName={object.name}
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
