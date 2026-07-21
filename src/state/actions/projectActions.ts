import { createEditorCommand } from "../../domain/commands";
import {
  createInitialSnapshot,
  mergeSummary,
  pushCommand,
  selectionSnapshot,
  slugify,
  snapshotFrom,
  snapshotState,
} from "../editorStoreHelpers";
import type { EditorStoreGet, EditorStoreSet, EditorStoreState } from "../editorStoreTypes";
import { createObjectDefinition, createObjectInstanceLayer } from "../../domain/layers";
import { createMappedImageImportSurface } from "../../domain/imageImport";
import { BLACK_PIXEL } from "../../domain/types";
import {
  openImageFileWithDesktopDialog,
  openProjectFileWithDesktopDialog,
  saveBlobWithDesktopDialog,
} from "../../desktop/desktopApi";
import { canvasToBlob, createProjectBundle, createPlaydatePngCanvas } from "../../export/playdateExport";
import {
  deleteProjectDocument,
  listProjectSummaries,
  loadProjectDocument,
  saveProjectDocument,
} from "../../persistence/projectDb";
import {
  deserializeProject,
  exportProjectJson,
  parseProjectJson,
  serializeProject,
} from "../../persistence/projectSchema";

type ProjectActions = Pick<
  EditorStoreState,
  | "newProject"
  | "renameProject"
  | "saveProject"
  | "loadProject"
  | "loadMostRecentProject"
  | "deleteProject"
  | "refreshProjects"
  | "exportProjectFile"
  | "openImageImportFile"
  | "importImageFile"
  | "commitImageImport"
  | "clearPendingImageImportFile"
  | "openProjectFile"
  | "importProjectFile"
  | "exportPng"
  | "exportBundle"
>;

export function createProjectActions(set: EditorStoreSet, get: EditorStoreGet): ProjectActions {
  let projectGeneration = 0;

  const importProjectText = async (text: string): Promise<void> => {
    const document = parseProjectJson(text);
    const snapshot = deserializeProject(document);
    const importedProjectId = crypto.randomUUID();
    const normalizedDocument = serializeProject(snapshot, importedProjectId, document.name);
    const importGeneration = ++projectGeneration;
    const saved = await saveProjectDocument(normalizedDocument);
    if (projectGeneration !== importGeneration) return;
    set((state) => ({
      ...snapshotState(snapshot),
      projectName: document.name,
      currentProjectId: importedProjectId,
      savedDocumentRevision: state.documentRevision + 1,
      pendingCommand: null,
      pendingImageImportFile: null,
      pendingMove: null,
      pendingSelectionMove: null,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      canvasToolPreview: null,
      activeSelectionCombineMode: null,
      editTarget: "pixels",
      rootSelection: null,
      objectSelection: null,
      status: "Project imported",
      activeSwatchRef: BLACK_PIXEL,
      documentRevision: state.documentRevision + 1,
      viewRevision: state.viewRevision + 1,
      hasUnsavedChanges: false,
      recentProjects: mergeSummary(state.recentProjects, saved),
    }));
  };

  return {
    newProject: () => {
      const snapshot = createInitialSnapshot();
      projectGeneration += 1;
      set((state) => ({
        ...snapshot,
        projectName: "Untitled Playdate Art",
        currentProjectId: null,
        savedDocumentRevision: state.documentRevision + 1,
        pendingCommand: null,
        pendingImageImportFile: null,
        pendingMove: null,
        pendingSelectionMove: null,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        canvasToolPreview: null,
        activeSelectionCombineMode: null,
        editTarget: "pixels",
        rootSelection: null,
        objectSelection: null,
        status: "New project",
        activeSwatchRef: BLACK_PIXEL,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: false,
      }));
    },

    renameProject: (projectName) =>
      set((state) =>
        state.projectName === projectName
          ? {}
          : {
              projectName,
              documentRevision: state.documentRevision + 1,
              viewRevision: state.viewRevision + 1,
              hasUnsavedChanges: true,
            },
      ),

    saveProject: async () => {
      const projectGenerationBeingSaved = projectGeneration;
      const state = get();
      const id = state.currentProjectId ?? crypto.randomUUID();

      if (state.currentProjectId === null) {
        set({ currentProjectId: id });
      }

      try {
        const documentRevisionBeingSaved = state.documentRevision;
        const document = serializeProject(snapshotFrom(state), id, state.projectName);
        const summary = await saveProjectDocument(document);
        set((current) => {
          const recentProjects = mergeSummary(current.recentProjects, summary);
          if (projectGeneration !== projectGenerationBeingSaved || current.currentProjectId !== id) {
            return { recentProjects };
          }

          const savedDocumentRevision = Math.max(current.savedDocumentRevision, documentRevisionBeingSaved);
          const allCurrentChangesSaved = current.documentRevision <= savedDocumentRevision;
          return {
            savedDocumentRevision,
            hasUnsavedChanges: allCurrentChangesSaved ? false : current.hasUnsavedChanges,
            status: allCurrentChangesSaved ? "Project saved locally" : current.status,
            recentProjects,
          };
        });
      } catch {
        if (projectGeneration === projectGenerationBeingSaved && get().currentProjectId === id) {
          set({ status: "Unable to save project locally" });
        }
      }
    },

    loadProject: async (id) => {
      const loadGeneration = ++projectGeneration;
      try {
        const document = await loadProjectDocument(id);
        if (projectGeneration !== loadGeneration) return;
        if (!document) {
          set({ status: "Project was not found" });
          return;
        }
        const snapshot = deserializeProject(document);
        set((state) => ({
          ...snapshotState(snapshot),
          projectName: document.name,
          currentProjectId: document.id,
          savedDocumentRevision: state.documentRevision + 1,
          pendingCommand: null,
          pendingImageImportFile: null,
          pendingMove: null,
          pendingSelectionMove: null,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
          canvasToolPreview: null,
          activeSelectionCombineMode: null,
          editTarget: "pixels",
          rootSelection: null,
          objectSelection: null,
          status: "Project loaded",
          activeSwatchRef: BLACK_PIXEL,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: false,
        }));
      } catch {
        if (projectGeneration === loadGeneration) set({ status: "Unable to load project" });
      }
    },

    loadMostRecentProject: async () => {
      const loadGeneration = ++projectGeneration;
      try {
        const recentProjects = await listProjectSummaries();
        if (projectGeneration !== loadGeneration) return;
        const mostRecentProject = recentProjects[0];
        set({ recentProjects });

        if (!mostRecentProject) {
          set({ status: "New project" });
          return;
        }

        const document = await loadProjectDocument(mostRecentProject.id);
        if (projectGeneration !== loadGeneration) return;
        if (!document) {
          set({ status: "Most recent project was not found" });
          return;
        }

        const snapshot = deserializeProject(document);
        set((state) => ({
          ...snapshotState(snapshot),
          projectName: document.name,
          currentProjectId: document.id,
          savedDocumentRevision: state.documentRevision + 1,
          pendingCommand: null,
          pendingImageImportFile: null,
          pendingMove: null,
          pendingSelectionMove: null,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
          canvasToolPreview: null,
          activeSelectionCombineMode: null,
          editTarget: "pixels",
          rootSelection: null,
          objectSelection: null,
          status: "Most recent project loaded",
          activeSwatchRef: BLACK_PIXEL,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: false,
          recentProjects,
        }));
      } catch {
        if (projectGeneration === loadGeneration) {
          set({ recentProjects: [], status: "Unable to read local projects" });
        }
      }
    },

    deleteProject: async (id) => {
      try {
        await deleteProjectDocument(id);
        set((state) => ({
          recentProjects: state.recentProjects.filter((project) => project.id !== id),
          status: "Project deleted",
        }));
      } catch {
        set({ status: "Unable to delete project" });
      }
    },

    refreshProjects: async () => {
      try {
        const recentProjects = await listProjectSummaries();
        set({ recentProjects });
      } catch {
        set({ recentProjects: [], status: "Unable to read local projects" });
      }
    },

    exportProjectFile: async () => {
      try {
        const state = get();
        const id = state.currentProjectId ?? crypto.randomUUID();
        const document = serializeProject(snapshotFrom(get()), id, state.projectName);
        const saved = await saveBlobWithDesktopDialog(
          new Blob([exportProjectJson(document)], { type: "application/json" }),
          `${slugify(document.name)}.playdate-pixel.json`,
        );
        if (saved) set({ status: "Project file exported" });
      } catch {
        set({ status: "Unable to export project file" });
      }
    },

    openImageImportFile: async () => {
      try {
        if (!window.pdps) {
          set({ status: "Use the command palette to choose an image file" });
          return;
        }
        const result = await openImageFileWithDesktopDialog();
        if (result.canceled) return;
        if (!result.data || !result.fileName || !result.mimeType) {
          set({ status: "Unable to read image file" });
          return;
        }
        set({
          pendingImageImportFile: {
            data: result.data,
            fileName: result.fileName,
            mimeType: result.mimeType,
          },
          status: "Image ready to import",
        });
      } catch {
        set({ status: "Unable to open image file" });
      }
    },

    importImageFile: async (file) => {
      try {
        set({
          pendingImageImportFile: {
            data: await file.arrayBuffer(),
            fileName: file.name,
            mimeType: file.type || mimeTypeForImageFileName(file.name),
          },
          status: "Image ready to import",
        });
      } catch {
        set({ status: "Unable to read image file" });
      }
    },

    clearPendingImageImportFile: () => {
      set({ pendingImageImportFile: null });
    },

    commitImageImport: ({ fileName, mapping, prepared }) => {
      const before = snapshotFrom(get());
      const beforeSelection = selectionSnapshot(get());
      const surface = createMappedImageImportSurface(prepared, mapping);
      const objectName = imageObjectName(fileName);
      const object = createObjectDefinition(crypto.randomUUID(), objectName, surface.width, surface.height);
      object.layers = [
        {
          ...object.layers[0],
          contentRevision: object.layers[0].contentRevision + 1,
          name: "Imported image",
          surface,
        },
      ];

      set((state) => {
        const layer = createObjectInstanceLayer(state.root.nextLayerId, object.name, object.id);
        layer.x = Math.floor((state.root.width - object.width) / 2);
        layer.y = Math.floor((state.root.height - object.height) / 2);
        const insertIndex = state.root.activeLayerIndex + 1;
        const layers = [...state.root.layers];
        layers.splice(insertIndex, 0, layer);

        return {
          objects: [...state.objects, object],
          root: {
            ...state.root,
            activeLayerIndex: insertIndex,
            layers,
            nextLayerId: state.root.nextLayerId + 1,
          },
          activeContext: { type: "root" },
          canvasToolPreview: null,
          activeSelectionCombineMode: null,
          editTarget: "pixels",
          objectSelection: null,
          pendingImageImportFile: null,
          rootSelection: null,
          status: `Imported ${fileName}`,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCommand(
        set,
        createEditorCommand(`Import ${objectName}`, before, snapshotFrom(get()), {
          beforeSelection,
          afterSelection: selectionSnapshot(get()),
        }),
      );
    },

    openProjectFile: async () => {
      try {
        const result = await openProjectFileWithDesktopDialog();
        if (result.canceled) return;
        if (!result.text) {
          set({ status: "Unable to read project file" });
          return;
        }
        await importProjectText(result.text);
      } catch {
        set({ status: "Unable to import project file" });
      }
    },

    importProjectFile: async (file) => {
      try {
        await importProjectText(await file.text());
      } catch {
        set({ status: "Unable to import project file" });
      }
    },

    exportPng: async () => {
      try {
        const state = get();
        const canvas = createPlaydatePngCanvas(
          state.root.layers,
          state.previewMode,
          state.objects,
          state.root.background,
          state.palette,
        );
        const saved = await saveBlobWithDesktopDialog(await canvasToBlob(canvas), `${slugify(state.projectName)}.png`);
        if (saved) set({ status: "PNG exported" });
      } catch {
        set({ status: "Unable to export PNG" });
      }
    },

    exportBundle: async () => {
      try {
        const state = get();
        const id = state.currentProjectId ?? crypto.randomUUID();
        const document = serializeProject(snapshotFrom(get()), id, state.projectName);
        const bundle = await createProjectBundle(
          document,
          state.root.layers,
          state.objects,
          state.root.background,
          state.palette,
        );
        const saved = await saveBlobWithDesktopDialog(bundle, `${slugify(document.name)}.playdate-pixel.zip`);
        if (saved) set({ status: "Project bundle exported" });
      } catch {
        set({ status: "Unable to export project bundle" });
      }
    },
  };
}

function imageObjectName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "").trim();
  return withoutExtension.length > 0 ? withoutExtension : "Imported Image";
}

function mimeTypeForImageFileName(fileName: string): string {
  return fileName.toLowerCase().endsWith(".gif") ? "image/gif" : "image/png";
}
