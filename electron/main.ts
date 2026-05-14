import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import type {
  FileFilter,
  MenuItemConstructorOptions,
  MessageBoxOptions,
  OpenDialogOptions,
  SaveDialogOptions,
} from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  startPlaydateStreamServer,
  type PlaydateStreamFrameRequest,
  type PlaydateStreamServerHandle,
} from "../companion/stream/server.ts";

interface SaveBlobRequest {
  filename: string;
  mimeType?: string;
  data: ArrayBuffer;
}

interface DesktopActionResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  fileName?: string;
  text?: string;
  error?: string;
}

interface DesktopMenuCommand {
  id:
    | "project:new"
    | "project:save"
    | "project:open-recent"
    | "project:import"
    | "project:export-png"
    | "project:export-json"
    | "project:export-bundle"
    | "edit:undo"
    | "edit:redo"
    | "edit:clear-selection"
    | "edit:clear-layer"
    | "edit:invert-layer"
    | "view:toggle-grid"
    | "view:toggle-colorized-patterns"
    | "view:set-grid-size";
  projectId?: string;
  gridSize?: number;
}

interface DesktopMenuState {
  activeLayerPixelEditable: boolean;
  canRedo: boolean;
  canUndo: boolean;
  colorizedPatternsVisible: boolean;
  gridSize: number;
  gridVisible: boolean;
  hasSelection: boolean;
  hasUnsavedChanges: boolean;
  recentProjects: Array<{ id: string; name: string }>;
}

let mainWindow: BrowserWindow | null = null;
let streamHandle: PlaydateStreamServerHandle | null = null;
let streamError: string | null = null;
let streamStarting: Promise<void> | null = null;
let streamStopping: Promise<void> | null = null;
let rendererMenuState: DesktopMenuState = {
  activeLayerPixelEditable: false,
  canRedo: false,
  canUndo: false,
  colorizedPatternsVisible: false,
  gridSize: 1,
  gridVisible: false,
  hasSelection: false,
  hasUnsavedChanges: false,
  recentProjects: [],
};

const electronDir = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
const GRID_SIZE_STEPS = [1, 2, 4, 8, 16, 32, 64] as const;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: "Playdate Pixel Studio",
    backgroundColor: "#f6f5f1",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(electronDir, "preload.cjs"),
    },
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    loadRendererUrl(mainWindow, rendererUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    loadPackagedRenderer(mainWindow);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function loadRendererUrl(window: BrowserWindow, rendererUrl: string): void {
  void window.loadURL(rendererUrl).catch((error: unknown) => {
    console.error(`Unable to load Electron renderer URL ${rendererUrl}: ${errorMessage(error)}`);
  });
}

function loadPackagedRenderer(window: BrowserWindow): void {
  const indexPath = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked", "dist", "index.html")
    : path.join(app.getAppPath(), "dist", "index.html");
  void window.loadFile(indexPath).catch((error: unknown) => {
    console.error(`Unable to load packaged renderer ${indexPath}: ${errorMessage(error)}`);
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle("pdps:save-blob", async (event, request: SaveBlobRequest): Promise<DesktopActionResult> => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow ?? undefined;
      const options: SaveDialogOptions = {
        defaultPath: sanitizeFilename(request.filename),
        filters: filtersForFilename(request.filename),
      };
      const { canceled, filePath } = owner
        ? await dialog.showSaveDialog(owner, options)
        : await dialog.showSaveDialog(options);

      if (canceled || !filePath) return { ok: true, canceled: true };

      await fs.writeFile(filePath, Buffer.from(request.data));
      return { ok: true, filePath };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle("pdps:open-project-file", async (event): Promise<DesktopActionResult> => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow ?? undefined;
      const options: OpenDialogOptions = {
        properties: ["openFile"],
        filters: [{ name: "Playdate Pixel Studio Project", extensions: ["json"] }],
      };
      const { canceled, filePaths } = owner
        ? await dialog.showOpenDialog(owner, options)
        : await dialog.showOpenDialog(options);

      if (canceled || filePaths.length === 0) return { ok: true, canceled: true };

      const filePath = filePaths[0];
      const text = await fs.readFile(filePath, "utf8");
      return { ok: true, filePath, fileName: path.basename(filePath), text };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle("pdps:save-companion-pdx", async (event): Promise<DesktopActionResult> => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow ?? undefined;
      const { canceled, filePaths } = owner
        ? await dialog.showOpenDialog(owner, {
            title: "Save Playdate Companion",
            buttonLabel: "Save Companion",
            properties: ["openDirectory", "createDirectory"],
          })
        : await dialog.showOpenDialog({
            title: "Save Playdate Companion",
            buttonLabel: "Save Companion",
            properties: ["openDirectory", "createDirectory"],
          });

      if (canceled || filePaths.length === 0) return { ok: true, canceled: true };

      const targetPath = path.join(filePaths[0], "playdate-pixel-preview.pdx");
      if (await pathExists(targetPath)) {
        const { response } = owner
          ? await dialog.showMessageBox(owner, overwriteCompanionDialogOptions(targetPath))
          : await dialog.showMessageBox(overwriteCompanionDialogOptions(targetPath));
        if (response !== 1) return { ok: true, canceled: true };
      }

      await fs.rm(targetPath, { recursive: true, force: true });
      await fs.cp(companionPdxPath(), targetPath, { recursive: true });
      return { ok: true, filePath: targetPath };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle("pdps:open-companion-in-simulator", async (): Promise<DesktopActionResult> => {
    try {
      const pdxPath = companionPdxPath();
      await fs.access(pdxPath);
      const simulatorPath = await findPlaydateSimulatorPath();
      if (!simulatorPath) {
        return {
          ok: false,
          error: "Playdate Simulator was not found. Install the Playdate SDK or set PLAYDATE_SDK_PATH.",
        };
      }
      await openPdxInSimulator(simulatorPath, pdxPath);
      return { ok: true, filePath: pdxPath };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle("pdps:stream-start", async () => {
    await startPlaydateStream();
    return streamStatusPayload();
  });

  ipcMain.handle("pdps:stream-stop", async () => {
    await stopPlaydateStream();
    return streamStatusPayload();
  });

  ipcMain.handle("pdps:stream-health", () => requireStream().getHealth());

  ipcMain.handle("pdps:stream-info", () => requireStream().getInfo());

  ipcMain.handle("pdps:stream-devices", () => requireStream().getDevices());

  ipcMain.handle("pdps:stream-frame", (_event, request: PlaydateStreamFrameRequest) => {
    try {
      return requireStream().postFrame(validateFrameRequest(request));
    } catch (error) {
      return {
        ok: false,
        error: errorMessage(error),
        revision: Number.isFinite(request?.revision) ? request.revision : 0,
        streamId: typeof request?.streamId === "string" ? request.streamId : "electron-stream",
        connectedDevices: 0,
        devices: [],
      };
    }
  });

  ipcMain.handle("pdps:menu-state", (_event, state: DesktopMenuState) => {
    rendererMenuState = normalizeDesktopMenuState(state);
    createApplicationMenu();
  });
}

function createApplicationMenu(): void {
  const recentProjectsSubmenu: MenuItemConstructorOptions[] =
    rendererMenuState.recentProjects.length > 0
      ? rendererMenuState.recentProjects.map((project) => ({
          label: project.name,
          click: () => sendMenuCommand({ id: "project:open-recent", projectId: project.id }),
        }))
      : [{ label: "No Recent Projects", enabled: false }];

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [{ role: "about" }, { type: "separator" }, { role: "hide" }, { role: "quit" }],
      },
      {
        label: "File",
        submenu: [
          {
            label: "New Project",
            accelerator: "Shift+CmdOrCtrl+N",
            click: () => sendMenuCommand({ id: "project:new" }),
          },
          {
            label: rendererMenuState.hasUnsavedChanges ? "Save Project*" : "Save Project",
            accelerator: "CmdOrCtrl+S",
            click: () => sendMenuCommand({ id: "project:save" }),
          },
          {
            label: "Open Recent",
            submenu: recentProjectsSubmenu,
          },
          {
            label: "Import Project",
            click: () => sendMenuCommand({ id: "project:import" }),
          },
          { type: "separator" },
          {
            label: "Export PNG",
            click: () => sendMenuCommand({ id: "project:export-png" }),
          },
          {
            label: "Export Project JSON",
            click: () => sendMenuCommand({ id: "project:export-json" }),
          },
          {
            label: "Export Project Bundle",
            click: () => sendMenuCommand({ id: "project:export-bundle" }),
          },
          { type: "separator" },
          { role: "close" },
        ],
      },
      {
        label: "Edit",
        submenu: [
          {
            label: "Undo",
            accelerator: "CmdOrCtrl+Z",
            enabled: rendererMenuState.canUndo,
            click: () => sendMenuCommand({ id: "edit:undo" }),
          },
          {
            label: "Redo",
            accelerator: "Shift+CmdOrCtrl+Z",
            enabled: rendererMenuState.canRedo,
            click: () => sendMenuCommand({ id: "edit:redo" }),
          },
          { type: "separator" },
          {
            label: "Clear Selection",
            accelerator: "CmdOrCtrl+D",
            enabled: rendererMenuState.hasSelection,
            click: () => sendMenuCommand({ id: "edit:clear-selection" }),
          },
          { type: "separator" },
          {
            label: "Clear Layer",
            enabled: rendererMenuState.activeLayerPixelEditable,
            click: () => sendMenuCommand({ id: "edit:clear-layer" }),
          },
          {
            label: "Invert Layer",
            enabled: rendererMenuState.activeLayerPixelEditable,
            click: () => sendMenuCommand({ id: "edit:invert-layer" }),
          },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [
          {
            label: "Grid",
            type: "checkbox",
            checked: rendererMenuState.gridVisible,
            click: () => sendMenuCommand({ id: "view:toggle-grid" }),
          },
          {
            label: "Colorized Patterns",
            type: "checkbox",
            checked: rendererMenuState.colorizedPatternsVisible,
            click: () => sendMenuCommand({ id: "view:toggle-colorized-patterns" }),
          },
          {
            label: "Grid Size",
            submenu: GRID_SIZE_STEPS.map((gridSize) => ({
              label: `${gridSize}px`,
              type: "radio",
              checked: rendererMenuState.gridSize === gridSize,
              click: () => sendMenuCommand({ id: "view:set-grid-size", gridSize }),
            })),
          },
          { type: "separator" },
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      {
        label: "Window",
        submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }],
      },
    ]),
  );
}

function sendMenuCommand(command: DesktopMenuCommand): void {
  mainWindow?.webContents.send("pdps:menu-command", command);
}

function normalizeDesktopMenuState(state: DesktopMenuState): DesktopMenuState {
  return {
    activeLayerPixelEditable: Boolean(state?.activeLayerPixelEditable),
    canRedo: Boolean(state?.canRedo),
    canUndo: Boolean(state?.canUndo),
    colorizedPatternsVisible: Boolean(state?.colorizedPatternsVisible),
    gridSize: GRID_SIZE_STEPS.includes(state?.gridSize as (typeof GRID_SIZE_STEPS)[number]) ? state.gridSize : 1,
    gridVisible: Boolean(state?.gridVisible),
    hasSelection: Boolean(state?.hasSelection),
    hasUnsavedChanges: Boolean(state?.hasUnsavedChanges),
    recentProjects: Array.isArray(state?.recentProjects)
      ? state.recentProjects
          .filter((project) => typeof project?.id === "string" && typeof project?.name === "string")
          .map((project) => ({ id: project.id, name: project.name || "Untitled Project" }))
      : [],
  };
}

async function startPlaydateStream(): Promise<void> {
  if (streamStopping) {
    await streamStopping;
  }
  if (streamHandle) return;
  if (streamStarting) return streamStarting;
  streamError = null;

  streamStarting = startPlaydateStreamServer()
    .then((handle) => {
      streamHandle = handle;
      streamError = null;
    })
    .catch((error: unknown) => {
      streamHandle = null;
      streamError = errorMessage(error);
      console.warn(`Playdate stream did not start: ${streamError}`);
      throw error;
    })
    .finally(() => {
      streamStarting = null;
    });

  return streamStarting;
}

async function stopPlaydateStream(): Promise<void> {
  if (streamStarting) {
    await streamStarting.catch(() => undefined);
  }
  if (streamStopping) return streamStopping;
  if (!streamHandle) return;

  const stream = streamHandle;
  streamHandle = null;
  streamError = null;

  streamStopping = stream.stop().finally(() => {
    streamStopping = null;
  });

  return streamStopping;
}

function streamStatusPayload(): {
  ok: boolean;
  running: boolean;
  starting: boolean;
  stopping: boolean;
  error: string | null;
  streamPort: number | null;
} {
  return {
    ok: streamError === null && Boolean(streamHandle),
    running: Boolean(streamHandle),
    starting: Boolean(streamStarting),
    stopping: Boolean(streamStopping),
    error: streamError,
    streamPort: streamHandle?.streamPort ?? null,
  };
}

function requireStream(): PlaydateStreamServerHandle {
  if (!streamHandle) {
    throw new Error(streamError ?? "Playdate stream is not running.");
  }
  return streamHandle;
}

function validateFrameRequest(request: PlaydateStreamFrameRequest): PlaydateStreamFrameRequest {
  if (!request || typeof request !== "object") throw new Error("Frame request is invalid.");
  if (!Number.isFinite(request.revision) || request.revision < 0) throw new Error("Frame revision is invalid.");
  if (typeof request.streamId !== "string" || request.streamId.trim().length === 0) {
    throw new Error("Frame stream id is invalid.");
  }
  if (!Number.isFinite(request.flags ?? 0) || (request.flags ?? 0) < 0) throw new Error("Frame flags are invalid.");
  if (!(request.payload instanceof ArrayBuffer) && !(request.payload instanceof Uint8Array)) {
    throw new Error("Frame payload is invalid.");
  }
  return request;
}

function sanitizeFilename(filename: string): string {
  const cleaned = filename.replace(/[/:\\]/g, "-").trim();
  return cleaned.length > 0 ? cleaned : "playdate-pixel-export";
}

function filtersForFilename(filename: string): FileFilter[] {
  if (filename.endsWith(".png")) return [{ name: "PNG Image", extensions: ["png"] }];
  if (filename.endsWith(".zip")) return [{ name: "ZIP Archive", extensions: ["zip"] }];
  if (filename.endsWith(".json")) return [{ name: "JSON Project", extensions: ["json"] }];
  return [{ name: "All Files", extensions: ["*"] }];
}

function companionPdxPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "playdate-pixel-preview.pdx")
    : path.join(app.getAppPath(), "companion", "playdate-preview", "playdate-pixel-preview.pdx");
}

function overwriteCompanionDialogOptions(targetPath: string): MessageBoxOptions {
  return {
    type: "warning",
    buttons: ["Cancel", "Replace"],
    defaultId: 1,
    cancelId: 0,
    message: "Replace existing Playdate companion?",
    detail: `${targetPath} already exists.`,
  };
}

async function findPlaydateSimulatorPath(): Promise<string | null> {
  const sdkRoots = await candidateSdkRoots();
  for (const sdkRoot of sdkRoots) {
    const candidates =
      process.platform === "darwin"
        ? [path.join(sdkRoot, "bin", "Playdate Simulator.app")]
        : [path.join(sdkRoot, "bin", "PlaydateSimulator")];
    for (const candidate of candidates) {
      if (await pathExists(candidate)) return candidate;
    }
  }
  return null;
}

async function candidateSdkRoots(): Promise<string[]> {
  const candidates = [
    process.env.PLAYDATE_SDK_PATH,
    await readPlaydateConfigSdkRoot(),
    path.join(os.homedir(), "Developer", "PlaydateSDK"),
  ].filter((candidate): candidate is string => Boolean(candidate));
  return [...new Set(candidates.map((candidate) => candidate.replace(/\/export$/, "")))];
}

async function readPlaydateConfigSdkRoot(): Promise<string | null> {
  try {
    const config = await fs.readFile(path.join(os.homedir(), ".Playdate", "config"), "utf8");
    const match = /^SDKRoot\s+(.+)$/m.exec(config);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

async function openPdxInSimulator(simulatorPath: string, pdxPath: string): Promise<void> {
  if (process.platform === "darwin") {
    await execFileAsync("open", ["-a", simulatorPath, pdxPath]);
    return;
  }
  await execFileAsync(simulatorPath, [pdxPath]);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected desktop app error.";
}

void app.whenReady().then(() => {
  registerIpcHandlers();
  createApplicationMenu();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (!streamHandle) return;

  event.preventDefault();
  void stopPlaydateStream().finally(() => app.quit());
});
