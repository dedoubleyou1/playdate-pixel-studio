import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (thumbnailRef.current) {
      renderObjectThumbnail(thumbnailRef.current, object);
    }
  }, [object, revision]);

  return (
    <div
      className={`object-item${active ? " is-active" : ""}`}
      draggable
      onClick={() => onSelect(object.id)}
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-playdate-object", object.id);
        event.dataTransfer.effectAllowed = "copy";
      }}
    >
      <canvas
        ref={thumbnailRef}
        className="object-thumb"
        height={40}
        width={64}
        aria-label={`${object.name} preview`}
      />
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
