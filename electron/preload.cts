import { contextBridge, ipcRenderer } from "electron";

interface DesktopMenuCommand {
  id: string;
  projectId?: string;
  gridSize?: number;
}

contextBridge.exposeInMainWorld("pdps", {
  isElectron: true,
  files: {
    saveBlob: (request: { filename: string; mimeType?: string; data: ArrayBuffer }) =>
      ipcRenderer.invoke("pdps:save-blob", request),
    openProjectFile: () => ipcRenderer.invoke("pdps:open-project-file"),
    saveCompanionPdx: () => ipcRenderer.invoke("pdps:save-companion-pdx"),
    openCompanionInSimulator: () => ipcRenderer.invoke("pdps:open-companion-in-simulator"),
  },
  stream: {
    start: () => ipcRenderer.invoke("pdps:stream-start"),
    stop: () => ipcRenderer.invoke("pdps:stream-stop"),
    getHealth: () => ipcRenderer.invoke("pdps:stream-health"),
    getInfo: () => ipcRenderer.invoke("pdps:stream-info"),
    getDevices: () => ipcRenderer.invoke("pdps:stream-devices"),
    sendFrame: (request: {
      revision: number;
      streamId: string;
      flags: number;
      payload: ArrayBuffer;
      crc32: number;
    }) => ipcRenderer.invoke("pdps:stream-frame", request),
  },
  menu: {
    onCommand: (handler: (command: DesktopMenuCommand) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, command: DesktopMenuCommand) => handler(command);
      ipcRenderer.on("pdps:menu-command", listener);
      return () => ipcRenderer.removeListener("pdps:menu-command", listener);
    },
    setState: (state: unknown) => ipcRenderer.invoke("pdps:menu-state", state),
  },
});
