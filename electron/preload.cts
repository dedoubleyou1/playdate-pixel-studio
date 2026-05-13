import { contextBridge, ipcRenderer } from "electron";

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
});
