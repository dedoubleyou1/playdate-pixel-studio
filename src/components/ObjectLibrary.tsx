import { useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ObjectDefinition } from "../domain/types";
import { renderObjectThumbnail } from "../rendering/compositor";
import { useEditorStore } from "../state/editorStore";

export function ObjectLibrary(): React.JSX.Element {
  const objects = useEditorStore((state) => state.objects);
  const activeContext = useEditorStore((state) => state.activeContext);
  const addObject = useEditorStore((state) => state.addObject);
  const renameObject = useEditorStore((state) => state.renameObject);
  const switchToObject = useEditorStore((state) => state.switchToObject);
  const revision = useEditorStore((state) => state.revision);

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
              key={object.id}
              object={object}
              onRename={renameObject}
              onSelect={switchToObject}
              revision={revision}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ObjectRow({
  active,
  object,
  onRename,
  onSelect,
  revision,
}: {
  active: boolean;
  object: ObjectDefinition;
  onRename: (objectId: string, name: string) => void;
  onSelect: (objectId: string) => void;
  revision: number;
}): React.JSX.Element {
  const thumbnailRef = useRef<HTMLCanvasElement | null>(null);
  const thumbnailSize = getObjectThumbnailSize(object.width, object.height);
  const { isDragging, ref: draggableRef } = useDraggable({
    id: `object:${object.id}`,
    type: "object",
    data: {
      kind: "object",
      objectId: object.id,
    },
  });

  useEffect(() => {
    if (thumbnailRef.current) {
      renderObjectThumbnail(thumbnailRef.current, object);
    }
  }, [object, revision]);

  return (
    <div
      ref={draggableRef}
      className={`object-item${active ? " is-active" : ""}${isDragging ? " is-dragging" : ""}`}
      onClick={() => onSelect(object.id)}
    >
      <div className="object-thumb-frame">
        <canvas
          ref={thumbnailRef}
          className="object-thumb"
          height={object.height}
          style={{
            height: `${thumbnailSize.height}px`,
            width: `${thumbnailSize.width}px`,
          }}
          width={object.width}
          aria-label={`${object.name} preview`}
        />
      </div>
      <input
        className="object-name"
        aria-label="Object name"
        value={object.name}
        onChange={(event) => onRename(object.id, event.target.value.trim() || object.name)}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

function getObjectThumbnailSize(width: number, height: number): { width: number; height: number } {
  const maxWidth = 56;
  const maxHeight = 40;
  const scale = Math.min(maxWidth / width, maxHeight / height);

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}
