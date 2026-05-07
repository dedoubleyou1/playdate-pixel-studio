import { useState } from "react";
import { ArrowLeft, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ObjectDefinition } from "../domain/types";
import { useEditorStore } from "../state/editorStore";

export function ObjectContextBar(): React.JSX.Element {
  const activeContext = useEditorStore((state) => state.activeContext);
  const objects = useEditorStore((state) => state.objects);
  const switchToRoot = useEditorStore((state) => state.switchToRoot);
  const resizeObject = useEditorStore((state) => state.resizeObject);
  const object =
    activeContext.type === "object" ? objects.find((candidate) => candidate.id === activeContext.objectId) : null;

  return (
    <nav className="object-context-bar" aria-label="Object editing context">
      <Button variant="outline" size="sm" onClick={switchToRoot}>
        <ArrowLeft size={15} aria-hidden />
        Back to canvas
      </Button>
      {object ? (
        <div className="object-context-title">
          <Box size={16} aria-hidden />
          <strong>{object.name}</strong>
          <ObjectDimensions
            key={`${object.id}-${object.width}-${object.height}`}
            object={object}
            onResize={resizeObject}
          />
        </div>
      ) : null}
    </nav>
  );
}

function ObjectDimensions({
  object,
  onResize,
}: {
  object: ObjectDefinition;
  onResize: (objectId: string, width: number, height: number) => void;
}): React.JSX.Element {
  const [widthValue, setWidthValue] = useState(String(object.width));
  const [heightValue, setHeightValue] = useState(String(object.height));

  const commitDimensions = () => {
    const width = Number.parseInt(widthValue, 10);
    const height = Number.parseInt(heightValue, 10);
    if (width === object.width && height === object.height) return;
    onResize(object.id, width, height);
  };

  return (
    <div className="object-dimensions" aria-label="Object dimensions">
      <Label htmlFor="object-width">W</Label>
      <Input
        id="object-width"
        inputMode="numeric"
        min={1}
        max={400}
        type="number"
        value={widthValue}
        onBlur={commitDimensions}
        onChange={(event) => setWidthValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <Label htmlFor="object-height">H</Label>
      <Input
        id="object-height"
        inputMode="numeric"
        min={1}
        max={400}
        type="number"
        value={heightValue}
        onBlur={commitDimensions}
        onChange={(event) => setHeightValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </div>
  );
}
