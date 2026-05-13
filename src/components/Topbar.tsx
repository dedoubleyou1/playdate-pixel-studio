import {
  Archive,
  Download,
  FileDown,
  FilePlus2,
  Redo2,
  RotateCcwSquare,
  Save,
  SquareDashed,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { PlaydateStreamMenu } from "./PlaydateStreamMenu";
import { EditorHeader, EditorHeaderCenter, EditorHeaderLeft, EditorHeaderRight } from "./layout/editor-layout";
import { activeLayer, isPixelEditableLayer } from "../domain/layers";
import { hasActiveSelection, useEditorStore } from "../state/editorStore";

const GRID_SIZE_STEPS = [1, 2, 4, 8, 16, 32, 64] as const;

export function Topbar(): React.JSX.Element {
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const activeLayerPixelEditable = useEditorStore((state) => isPixelEditableLayer(activeLayer(state)));
  const hasSelection = useEditorStore(hasActiveSelection);
  const projectName = useEditorStore((state) => state.projectName);
  const hasUnsavedChanges = useEditorStore((state) => state.hasUnsavedChanges);
  const recentProjects = useEditorStore((state) => state.recentProjects);
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const setGridVisible = useEditorStore((state) => state.setGridVisible);
  const gridSize = useEditorStore((state) => state.gridSize);
  const setGridSize = useEditorStore((state) => state.setGridSize);
  const colorizedPatternsVisible = useEditorStore((state) => state.colorizedPatternsVisible);
  const setColorizedPatternsVisible = useEditorStore((state) => state.setColorizedPatternsVisible);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const clearActiveLayer = useEditorStore((state) => state.clearActiveLayer);
  const invertActiveLayer = useEditorStore((state) => state.invertActiveLayer);
  const newProject = useEditorStore((state) => state.newProject);
  const renameProject = useEditorStore((state) => state.renameProject);
  const saveProject = useEditorStore((state) => state.saveProject);
  const loadProject = useEditorStore((state) => state.loadProject);
  const exportProjectFile = useEditorStore((state) => state.exportProjectFile);
  const openProjectFile = useEditorStore((state) => state.openProjectFile);
  const exportPng = useEditorStore((state) => state.exportPng);
  const exportBundle = useEditorStore((state) => state.exportBundle);

  return (
    <EditorHeader aria-label="Application menu">
      <EditorHeaderLeft>
        <Menubar className="h-auto border-0 bg-transparent p-0 shadow-none">
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
              <MenubarItem
                onSelect={() => {
                  void openProjectFile();
                }}
              >
                <Upload />
                Import Project
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onSelect={() => void exportPng()}>
                <Download />
                Export PNG
              </MenubarItem>
              <MenubarItem onSelect={() => void exportProjectFile()}>
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
              <MenubarItem disabled={!hasSelection} onSelect={clearSelection}>
                <SquareDashed />
                Clear Selection
                <MenubarShortcut>⌘D</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem disabled={!activeLayerPixelEditable} onSelect={clearActiveLayer}>
                <Trash2 />
                Clear Layer
              </MenubarItem>
              <MenubarItem disabled={!activeLayerPixelEditable} onSelect={invertActiveLayer}>
                <RotateCcwSquare />
                Invert Layer
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent>
              <MenubarCheckboxItem checked={gridVisible} onCheckedChange={(checked) => setGridVisible(Boolean(checked))}>
                Grid
              </MenubarCheckboxItem>
              <MenubarCheckboxItem
                checked={colorizedPatternsVisible}
                onCheckedChange={(checked) => setColorizedPatternsVisible(Boolean(checked))}
              >
                Colorized Patterns
              </MenubarCheckboxItem>
              <MenubarSub>
                <MenubarSubTrigger>Grid Size</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarRadioGroup value={String(gridSize)} onValueChange={(value) => setGridSize(Number(value))}>
                    {GRID_SIZE_STEPS.map((size) => (
                      <MenubarRadioItem key={size} value={String(size)}>
                        {size}px
                      </MenubarRadioItem>
                    ))}
                  </MenubarRadioGroup>
                </MenubarSubContent>
              </MenubarSub>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </EditorHeaderLeft>
      <EditorHeaderCenter>
        <Input
          className="w-full max-w-[280px] text-center"
          aria-label="Project name"
          value={projectName}
          onChange={(event) => renameProject(event.target.value)}
        />
      </EditorHeaderCenter>
      <EditorHeaderRight>
        <PlaydateStreamMenu />
      </EditorHeaderRight>
    </EditorHeader>
  );
}
