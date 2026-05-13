export interface DesktopSaveBlobRequest {
  filename: string;
  mimeType?: string;
  data: ArrayBuffer;
}

export interface DesktopFileResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  fileName?: string;
  text?: string;
  error?: string;
}

export interface DesktopBridgeStatus {
  ok: boolean;
  running: boolean;
  restarting: boolean;
  error: string | null;
  streamPort: number | null;
  sessionCode: string | null;
}

export interface DesktopBridgeDevice {
  id: string;
  address: string;
  connectedForMs: number;
  authenticatedForMs: number | null;
  lastFrameAgeMs: number | null;
  lastRevisionSent: number | null;
  packetsSent: number;
  bytesSent: number;
}

export interface DesktopBridgeHealth {
  ok: boolean;
  service: string;
  streamPort: number;
  latestRevision: number | null;
  latestStreamId: string | null;
  latestFrameAgeMs: number | null;
  latestFrameBytes: number | null;
  connectedDevices: number;
  devices: DesktopBridgeDevice[];
}

export interface DesktopBridgeSession {
  sessionCode: string;
  streamPort: number;
  hostCandidates: string[];
  latestRevision: number | null;
  latestStreamId: string | null;
  connectedDevices: number;
  devices: DesktopBridgeDevice[];
}

export interface DesktopBridgeFrameRequest {
  revision: number;
  streamId: string;
  flags: number;
  payload: ArrayBuffer;
  crc32: number;
}

export interface DesktopBridgeFrameResult {
  ok: boolean;
  ignored?: boolean;
  revision: number;
  streamId: string;
  latestRevision?: number | null;
  latestStreamId?: string | null;
  bytes?: number;
  connectedDevices: number;
  devices: DesktopBridgeDevice[];
  error?: string;
}

export interface PlaydatePixelDesktopApi {
  isElectron: true;
  files: {
    saveBlob: (request: DesktopSaveBlobRequest) => Promise<DesktopFileResult>;
    openProjectFile: () => Promise<DesktopFileResult>;
  };
  bridge: {
    getStatus: () => Promise<DesktopBridgeStatus>;
    getHealth: () => Promise<DesktopBridgeHealth>;
    getSession: () => Promise<DesktopBridgeSession>;
    getDevices: () => Promise<{ connectedDevices: number; devices: DesktopBridgeDevice[] }>;
    sendFrame: (request: DesktopBridgeFrameRequest) => Promise<DesktopBridgeFrameResult>;
    restart: () => Promise<DesktopBridgeStatus>;
  };
}

declare global {
  interface Window {
    pdps?: PlaydatePixelDesktopApi;
  }
}

export async function saveBlobWithDesktopDialog(blob: Blob, filename: string): Promise<boolean> {
  const desktopApi = requireDesktopApi();
  const result = await desktopApi.files.saveBlob({
    filename,
    mimeType: blob.type,
    data: await blob.arrayBuffer(),
  });

  if (!result.ok) throw new Error(result.error ?? "Unable to save file.");
  return !result.canceled;
}

export async function openProjectFileWithDesktopDialog(): Promise<DesktopFileResult> {
  const desktopApi = requireDesktopApi();
  const result = await desktopApi.files.openProjectFile();
  if (!result.ok) throw new Error(result.error ?? "Unable to open project file.");
  return result;
}

export async function getDesktopBridgeStatus(): Promise<DesktopBridgeStatus> {
  const desktopApi = requireDesktopApi();
  return desktopApi.bridge.getStatus();
}

export async function getDesktopBridgeHealth(): Promise<DesktopBridgeHealth> {
  const desktopApi = requireDesktopApi();
  return desktopApi.bridge.getHealth();
}

export async function getDesktopBridgeSession(): Promise<DesktopBridgeSession> {
  const desktopApi = requireDesktopApi();
  return desktopApi.bridge.getSession();
}

export async function getDesktopBridgeDevices(): Promise<{ connectedDevices: number; devices: DesktopBridgeDevice[] }> {
  const desktopApi = requireDesktopApi();
  return desktopApi.bridge.getDevices();
}

export async function sendDesktopBridgeFrame(
  request: DesktopBridgeFrameRequest,
): Promise<DesktopBridgeFrameResult> {
  const desktopApi = requireDesktopApi();
  const result = await desktopApi.bridge.sendFrame(request);
  if (!result.ok) throw new Error(result.error ?? "Unable to stream frame.");
  return result;
}

export async function restartDesktopBridge(): Promise<DesktopBridgeStatus> {
  const desktopApi = requireDesktopApi();
  return desktopApi.bridge.restart();
}

function requireDesktopApi(): PlaydatePixelDesktopApi {
  if (typeof window === "undefined" || !window.pdps) {
    throw new Error("Playdate Pixel Studio must be run in the Electron app.");
  }
  return window.pdps;
}
