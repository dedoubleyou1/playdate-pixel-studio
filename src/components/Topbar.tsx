import { Archive, Download, FileDown, FilePlus2, Redo2, Save, Undo2, Upload } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PlaydateStreamMenu } from "./PlaydateStreamMenu";
import { useEditorStore } from "../state/editorStore";

export function Topbar(): React.JSX.Element {
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const projectName = useEditorStore((state) => state.projectName);
  const hasUnsavedChanges = useEditorStore((state) => state.hasUnsavedChanges);
  const recentProjects = useEditorStore((state) => state.recentProjects);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const newProject = useEditorStore((state) => state.newProject);
  const renameProject = useEditorStore((state) => state.renameProject);
  const saveProject = useEditorStore((state) => state.saveProject);
  const loadProject = useEditorStore((state) => state.loadProject);
  const refreshProjects = useEditorStore((state) => state.refreshProjects);
  const exportProjectFile = useEditorStore((state) => state.exportProjectFile);
  const importProjectFile = useEditorStore((state) => state.importProjectFile);
  const exportPng = useEditorStore((state) => state.exportPng);
  const exportBundle = useEditorStore((state) => state.exportBundle);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  return (
    <header className="topbar">
      <div className="brand-block">
        <span className="brand-mark" />
        <div>
          <h1>Playdate Pixel Studio</h1>
          <p>400 x 240, 1-bit artboard</p>
        </div>
      </div>
      <div className="project-actions">
        <Input
          className="project-name-input"
          aria-label="Project name"
          value={projectName}
          onChange={(event) => renameProject(event.target.value)}
        />
        <TopbarIconButton label="New project" onClick={newProject}>
          <FilePlus2 />
        </TopbarIconButton>
        <Button variant={hasUnsavedChanges ? "secondary" : "outline"} onClick={() => void saveProject()}>
          <Save />
          {hasUnsavedChanges ? "Save*" : "Save"}
        </Button>
        <select
          className="recent-project-select"
          aria-label="Open recent project"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) void loadProject(event.target.value);
            event.currentTarget.value = "";
          }}
        >
          <option value="">Open recent</option>
          {recentProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <TopbarIconButton label="Import project" onClick={() => importInputRef.current?.click()}>
          <Upload />
        </TopbarIconButton>
        <input
          ref={importInputRef}
          hidden
          type="file"
          accept=".json,.playdate-pixel.json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importProjectFile(file);
            event.currentTarget.value = "";
          }}
        />
      </div>
      <div className="top-actions">
        <TopbarIconButton label="Undo" disabled={!canUndo} onClick={undo}>
          <Undo2 />
        </TopbarIconButton>
        <TopbarIconButton label="Redo" disabled={!canRedo} onClick={redo}>
          <Redo2 />
        </TopbarIconButton>
        <Button variant="outline" onClick={exportPng}>
          <Download />
          Export PNG
        </Button>
        <TopbarIconButton label="Export project JSON" onClick={exportProjectFile}>
          <FileDown />
        </TopbarIconButton>
        <TopbarIconButton label="Export project bundle" onClick={() => void exportBundle()}>
          <Archive />
        </TopbarIconButton>
        <PlaydateStreamMenu />
      </div>
    </header>
  );
}

function TopbarIconButton({
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
