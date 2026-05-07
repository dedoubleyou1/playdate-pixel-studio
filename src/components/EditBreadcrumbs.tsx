import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "../state/editorStore";

export function EditBreadcrumbs(): React.JSX.Element {
  const activeContext = useEditorStore((state) => state.activeContext);
  const objects = useEditorStore((state) => state.objects);
  const switchToRoot = useEditorStore((state) => state.switchToRoot);
  const object =
    activeContext.type === "object" ? objects.find((candidate) => candidate.id === activeContext.objectId) : null;

  return (
    <nav className="edit-breadcrumbs" aria-label="Editing context">
      <Button variant="outline" size="sm" onClick={switchToRoot}>
        Root Canvas
      </Button>
      {object ? (
        <>
          <ChevronRight size={14} aria-hidden />
          <span>Objects</span>
          <ChevronRight size={14} aria-hidden />
          <strong>{object.name}</strong>
        </>
      ) : null}
    </nav>
  );
}
