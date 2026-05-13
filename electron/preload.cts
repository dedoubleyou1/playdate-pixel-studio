import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("pdps", {
  isElectron: true,
  files: {
    saveBlob: (request: { filename: string; mimeType?: string; data: ArrayBuffer }) =>
      ipcRenderer.invoke("pdps:save-blob", request),
    openProjectFile: () => ipcRenderer.invoke("pdps:open-project-file"),
  },
  bridge: {
    start: () => ipcRenderer.invoke("pdps:bridge-start"),
    stop: () => ipcRenderer.invoke("pdps:bridge-stop"),
    getHealth: () => ipcRenderer.invoke("pdps:bridge-health"),
    getSession: () => ipcRenderer.invoke("pdps:bridge-session"),
    getDevices: () => ipcRenderer.invoke("pdps:bridge-devices"),
    sendFrame: (request: {
      revision: number;
      streamId: string;
      flags: number;
      payload: ArrayBuffer;
      crc32: number;
    }) => ipcRenderer.invoke("pdps:bridge-frame", request),
  },
});
