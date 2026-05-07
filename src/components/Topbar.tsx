import { Archive, Download, FileDown, FilePlus2, Redo2, Save, Undo2, Upload } from "lucide-react";
import { useRef } from "react";
import { Input } from "@/components/ui/input";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const exportProjectFile = useEditorStore((state) => state.exportProjectFile);
  const importProjectFile = useEditorStore((state) => state.importProjectFile);
  const exportPng = useEditorStore((state) => state.exportPng);
  const exportBundle = useEditorStore((state) => state.exportBundle);
  const importInputRef = useRef<HTMLInputElement | null>(null);

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
        <Select value="" onValueChange={(projectId) => void loadProject(projectId)}>
          <SelectTrigger className="recent-project-select-trigger" aria-label="Open recent project">
            <SelectValue placeholder="Open recent" />
          </SelectTrigger>
          <SelectContent align="end">
            {recentProjects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onSelect={newProject}>
                <FilePlus2 />
                New Project
                <MenubarShortcut>⇧⌘N</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onSelect={() => void saveProject()}>
                <Save />
                {hasUnsavedChanges ? "Save Project*" : "Save Project"}
                <MenubarShortcut>⌘S</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onSelect={() => importInputRef.current?.click()}>
                <Upload />
                Import Project
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onSelect={exportPng}>
                <Download />
                Export PNG
              </MenubarItem>
              <MenubarItem onSelect={exportProjectFile}>
                <FileDown />
                Export Project JSON
              </MenubarItem>
              <MenubarItem onSelect={() => void exportBundle()}>
                <Archive />
                Export Project Bundle
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Edit</MenubarTrigger>
            <MenubarContent>
              <MenubarItem disabled={!canUndo} onSelect={undo}>
                <Undo2 />
                Undo
                <MenubarShortcut>⌘Z</MenubarShortcut>
              </MenubarItem>
              <MenubarItem disabled={!canRedo} onSelect={redo}>
                <Redo2 />
                Redo
                <MenubarShortcut>⇧⌘Z</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
        <PlaydateStreamMenu />
      </div>
    </header>
  );
}
