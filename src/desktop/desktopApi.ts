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

export interface DesktopStreamStatus {
  ok: boolean;
  running: boolean;
  starting: boolean;
  stopping: boolean;
  error: string | null;
  streamPort: number | null;
}

export interface DesktopStreamDevice {
  address: string;
  connectedForMs: number;
  readyForMs: number | null;
  lastFrameAgeMs: number | null;
  lastRevisionSent: number | null;
  packetsSent: number;
  bytesSent: number;
}

export interface DesktopStreamHealth {
  ok: boolean;
  service: string;
  streamPort: number;
  latestRevision: number | null;
  latestStreamId: string | null;
  latestFrameAgeMs: number | null;
  latestFrameBytes: number | null;
  connectedDevices: number;
  devices: DesktopStreamDevice[];
}

export interface DesktopStreamInfo {
  streamPort: number;
  hostCandidates: string[];
  latestRevision: number | null;
  latestStreamId: string | null;
  connectedDevices: number;
  devices: DesktopStreamDevice[];
}

export interface DesktopStreamFrameRequest {
  revision: number;
  streamId: string;
  flags: number;
  payload: ArrayBuffer;
  crc32: number;
}

export interface DesktopStreamFrameResult {
  ok: boolean;
  ignored?: boolean;
  revision: number;
  streamId: string;
  latestRevision?: number | null;
  latestStreamId?: string | null;
  bytes?: number;
  connectedDevices: number;
  devices: DesktopStreamDevice[];
  error?: string;
}

export interface DesktopClipboardWriteSelectionResult {
  ok: boolean;
  error?: string;
}

export interface DesktopClipboardReadSelectionResult {
  ok: boolean;
  json: string | null;
  error?: string;
}

export type DesktopMenuCommandId =
  | "project:new"
  | "project:save"
  | "project:open-recent"
  | "project:import"
  | "project:export-png"
  | "project:export-json"
  | "project:export-bundle"
  | "edit:undo"
  | "edit:redo"
  | "edit:copy"
  | "edit:cut"
  | "edit:paste"
  | "edit:clear-selection"
  | "edit:clear-layer"
  | "edit:invert-layer"
  | "view:toggle-grid"
  | "view:toggle-colorized-patterns"
  | "view:set-grid-size";

export interface DesktopMenuCommand {
  id: DesktopMenuCommandId;
  projectId?: string;
  gridSize?: number;
}

export type DesktopNativeEditRole = "copy" | "cut" | "paste";

export interface DesktopMenuProjectSummary {
  id: string;
  name: string;
}

export interface DesktopMenuState {
  activeLayerPixelEditable: boolean;
  canRedo: boolean;
  canUndo: boolean;
  colorizedPatternsVisible: boolean;
  gridSize: number;
  gridVisible: boolean;
  hasSelection: boolean;
  hasUnsavedChanges: boolean;
  recentProjects: DesktopMenuProjectSummary[];
}

export interface PlaydatePixelDesktopApi {
  isElectron: true;
  files: {
    saveBlob: (request: DesktopSaveBlobRequest) => Promise<DesktopFileResult>;
    openProjectFile: () => Promise<DesktopFileResult>;
    saveCompanionPdx: () => Promise<DesktopFileResult>;
    openCompanionInSimulator: () => Promise<DesktopFileResult>;
  };
  stream: {
    start: () => Promise<DesktopStreamStatus>;
    stop: () => Promise<DesktopStreamStatus>;
    getHealth: () => Promise<DesktopStreamHealth>;
    getInfo: () => Promise<DesktopStreamInfo>;
    getDevices: () => Promise<{ connectedDevices: number; devices: DesktopStreamDevice[] }>;
    sendFrame: (request: DesktopStreamFrameRequest) => Promise<DesktopStreamFrameResult>;
  };
  clipboard: {
    writeSelection: (json: string) => Promise<DesktopClipboardWriteSelectionResult>;
    readSelection: () => Promise<DesktopClipboardReadSelectionResult>;
  };
  menu: {
    onCommand: (handler: (command: DesktopMenuCommand) => void) => () => void;
    setState: (state: DesktopMenuState) => Promise<void>;
    performNativeEdit: (role: DesktopNativeEditRole) => Promise<void>;
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

export async function saveCompanionPdxWithDesktopDialog(): Promise<DesktopFileResult> {
  const desktopApi = requireDesktopApi();
  const result = await desktopApi.files.saveCompanionPdx();
  if (!result.ok) throw new Error(result.error ?? "Unable to save Playdate companion.");
  return result;
}

export async function openCompanionPdxInSimulator(): Promise<DesktopFileResult> {
  const desktopApi = requireDesktopApi();
  const result = await desktopApi.files.openCompanionInSimulator();
  if (!result.ok) throw new Error(result.error ?? "Unable to open Playdate companion in Simulator.");
  return result;
}

export async function startDesktopStream(): Promise<DesktopStreamStatus> {
  const desktopApi = requireDesktopApi();
  return desktopApi.stream.start();
}

export async function stopDesktopStream(): Promise<DesktopStreamStatus> {
  const desktopApi = requireDesktopApi();
  return desktopApi.stream.stop();
}

export async function getDesktopStreamHealth(): Promise<DesktopStreamHealth> {
  const desktopApi = requireDesktopApi();
  return desktopApi.stream.getHealth();
}

export async function getDesktopStreamInfo(): Promise<DesktopStreamInfo> {
  const desktopApi = requireDesktopApi();
  return desktopApi.stream.getInfo();
}

export async function getDesktopStreamDevices(): Promise<{ connectedDevices: number; devices: DesktopStreamDevice[] }> {
  const desktopApi = requireDesktopApi();
  return desktopApi.stream.getDevices();
}

export async function sendDesktopStreamFrame(
  request: DesktopStreamFrameRequest,
): Promise<DesktopStreamFrameResult> {
  const desktopApi = requireDesktopApi();
  const result = await desktopApi.stream.sendFrame(request);
  if (!result.ok) throw new Error(result.error ?? "Unable to stream frame.");
  return result;
}

export async function writeSelectionToDesktopClipboard(json: string): Promise<boolean> {
  const desktopApi = requireDesktopApi();
  const result = await desktopApi.clipboard.writeSelection(json);
  if (!result.ok) throw new Error(result.error ?? "Unable to write selection to clipboard.");
  return true;
}

export async function readSelectionFromDesktopClipboard(): Promise<string | null> {
  const desktopApi = requireDesktopApi();
  const result = await desktopApi.clipboard.readSelection();
  if (!result.ok) throw new Error(result.error ?? "Unable to read selection from clipboard.");
  return result.json;
}

function requireDesktopApi(): PlaydatePixelDesktopApi {
  if (typeof window === "undefined" || !window.pdps) {
    throw new Error("Playdate Pixel Studio must be run in the Electron app.");
  }
  return window.pdps;
}
