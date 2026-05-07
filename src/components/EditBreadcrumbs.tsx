import { ArrowLeft, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "../state/editorStore";

export function ObjectContextBar(): React.JSX.Element {
  const activeContext = useEditorStore((state) => state.activeContext);
  const objects = useEditorStore((state) => state.objects);
  const switchToRoot = useEditorStore((state) => state.switchToRoot);
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
        </div>
      ) : null}
    </nav>
  );
}
