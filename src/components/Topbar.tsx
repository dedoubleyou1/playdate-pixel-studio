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
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { PlaydateStreamMenu } from "./PlaydateStreamMenu";
import { EditorHeader, EditorHeaderCenter, EditorHeaderLeft, EditorHeaderRight } from "./layout/editor-layout";
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
    <EditorHeader aria-label="Application menu">
      <EditorHeaderLeft>
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
              <MenubarSub>
                <MenubarSubTrigger disabled={recentProjects.length === 0}>Open Recent</MenubarSubTrigger>
                <MenubarSubContent>
                  {recentProjects.map((project) => (
                    <MenubarItem key={project.id} onSelect={() => void loadProject(project.id)}>
                      {project.name}
                    </MenubarItem>
                  ))}
                </MenubarSubContent>
              </MenubarSub>
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
      </EditorHeaderLeft>
      <EditorHeaderCenter>
        <Input
          className="project-name-input"
          aria-label="Project name"
          value={projectName}
          onChange={(event) => renameProject(event.target.value)}
        />
      </EditorHeaderCenter>
      <EditorHeaderRight>
        <PlaydateStreamMenu />
      </EditorHeaderRight>
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
    </EditorHeader>
  );
}
