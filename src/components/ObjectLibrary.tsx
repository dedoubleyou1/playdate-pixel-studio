import { Box, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorStore } from "../state/editorStore";

export function ObjectLibrary(): React.JSX.Element {
  const objects = useEditorStore((state) => state.objects);
  const activeContext = useEditorStore((state) => state.activeContext);
  const addObject = useEditorStore((state) => state.addObject);
  const renameObject = useEditorStore((state) => state.renameObject);
  const switchToObject = useEditorStore((state) => state.switchToObject);
  const placeObjectOnRoot = useEditorStore((state) => state.placeObjectOnRoot);

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
            <div
              className={`object-item${
                activeContext.type === "object" && activeContext.objectId === object.id ? " is-active" : ""
              }`}
              draggable
              key={object.id}
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-playdate-object", object.id);
                event.dataTransfer.effectAllowed = "copy";
              }}
            >
              <button className="object-main" type="button" onClick={() => switchToObject(object.id)}>
                <Box size={16} aria-hidden />
                <span>
                  <small>
                    {object.width} x {object.height}
                  </small>
                </span>
              </button>
              <input
                className="object-name"
                aria-label="Object name"
                value={object.name}
                onChange={(event) => renameObject(object.id, event.target.value.trim() || object.name)}
                onClick={(event) => event.stopPropagation()}
              />
              <Button variant="outline" size="sm" onClick={() => placeObjectOnRoot(object.id)}>
                Place
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
