import { contextBridge, ipcRenderer } from "electron";

interface DesktopMenuCommand {
  id: string;
  projectId?: string;
  gridSize?: number;
}

type NativeEditRole = "copy" | "cut" | "paste";

contextBridge.exposeInMainWorld("pdps", {
  isElectron: true,
  files: {
    saveBlob: (request: { filename: string; mimeType?: string; data: ArrayBuffer }) =>
      ipcRenderer.invoke("pdps:save-blob", request),
    openProjectFile: () => ipcRenderer.invoke("pdps:open-project-file"),
    openImageFile: () => ipcRenderer.invoke("pdps:open-image-file"),
    saveCompanionPdx: () => ipcRenderer.invoke("pdps:save-companion-pdx"),
    openCompanionInSimulator: () => ipcRenderer.invoke("pdps:open-companion-in-simulator"),
  },
  stream: {
    start: () => ipcRenderer.invoke("pdps:stream-start"),
    stop: () => ipcRenderer.invoke("pdps:stream-stop"),
    getHealth: () => ipcRenderer.invoke("pdps:stream-health"),
    getInfo: () => ipcRenderer.invoke("pdps:stream-info"),
    getDevices: () => ipcRenderer.invoke("pdps:stream-devices"),
    sendFrame: (request: { revision: number; streamId: string; flags: number; payload: ArrayBuffer; crc32: number }) =>
      ipcRenderer.invoke("pdps:stream-frame", request),
  },
  clipboard: {
    writeSelection: (json: string) => ipcRenderer.invoke("pdps:clipboard-write-selection", { json }),
    readSelection: () => ipcRenderer.invoke("pdps:clipboard-read-selection"),
  },
  menu: {
    onCommand: (handler: (command: DesktopMenuCommand) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, command: DesktopMenuCommand) => handler(command);
      ipcRenderer.on("pdps:menu-command", listener);
      return () => ipcRenderer.removeListener("pdps:menu-command", listener);
    },
    setState: (state: unknown) => ipcRenderer.invoke("pdps:menu-state", state),
    performNativeEdit: (role: NativeEditRole) => ipcRenderer.invoke("pdps:menu-native-edit", { role }),
  },
});
