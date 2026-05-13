import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import type { FileFilter, OpenDialogOptions, SaveDialogOptions } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

let mainWindow: BrowserWindow | null = null;
let streamHandle: PlaydateStreamServerHandle | null = null;
let streamError: string | null = null;
let streamStarting: Promise<void> | null = null;
let streamStopping: Promise<void> | null = null;

const electronDir = path.dirname(fileURLToPath(import.meta.url));

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

  ipcMain.handle("pdps:stream-start", async () => {
    await startPlaydateStream();
    return streamStatusPayload();
  });

  ipcMain.handle("pdps:stream-stop", async () => {
    await stopPlaydateStream();
    return streamStatusPayload();
  });

  ipcMain.handle("pdps:stream-health", () => requireStream().getHealth());

  ipcMain.handle("pdps:stream-session", () => requireStream().getSession());

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

}

function createApplicationMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [{ role: "about" }, { type: "separator" }, { role: "hide" }, { role: "quit" }],
      },
      {
        label: "File",
        submenu: [{ role: "close" }],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "togglefullscreen" }],
      },
      {
        label: "Window",
        submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }],
      },
    ]),
  );
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
  sessionCode: string | null;
} {
  return {
    ok: streamError === null && Boolean(streamHandle),
    running: Boolean(streamHandle),
    starting: Boolean(streamStarting),
    stopping: Boolean(streamStopping),
    error: streamError,
    streamPort: streamHandle?.streamPort ?? null,
    sessionCode: streamHandle?.sessionCode ?? null,
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
