/// <reference types="node" />

import net from "node:net";
import os from "node:os";
import { encodeFramePacket, PLAYDATE_FRAME_BYTES } from "../../src/companion/protocol.ts";
import { normalizeStreamId, shouldAcceptFrameRevision } from "../../src/companion/streamMetadata.ts";
import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../../src/domain/constants.ts";

const DEFAULT_STREAM_PORT = 9138;
const DEFAULT_SESSION_CODE = "ABC123";

export interface BridgeServerOptions {
  streamPort?: number;
  sessionCode?: string;
}

export interface BridgeServerHandle {
  streamPort: number;
  sessionCode: string;
  stop: () => Promise<void>;
  getHealth: () => BridgeHealth;
  getSession: () => BridgeSession;
  getDevices: () => BridgeDevicesPayload;
  postFrame: (frame: BridgeFrameRequest) => BridgeFrameResult;
}

export interface BridgeDevice {
  id: string;
  address: string;
  connectedForMs: number;
  authenticatedForMs: number | null;
  lastFrameAgeMs: number | null;
  lastRevisionSent: number | null;
  packetsSent: number;
  bytesSent: number;
}

export interface BridgeHealth {
  ok: boolean;
  service: "playdate-pixel-studio-bridge";
  streamPort: number;
  latestRevision: number | null;
  latestStreamId: string | null;
  latestFrameAgeMs: number | null;
  latestFrameBytes: number | null;
  connectedDevices: number;
  devices: BridgeDevice[];
}

export interface BridgeSession {
  sessionCode: string;
  streamPort: number;
  hostCandidates: string[];
  latestRevision: number | null;
  latestStreamId: string | null;
  connectedDevices: number;
  devices: BridgeDevice[];
}

export interface BridgeDevicesPayload {
  connectedDevices: number;
  devices: BridgeDevice[];
}

export interface BridgeFrameRequest {
  revision: number;
  streamId?: string;
  flags?: number;
  payload: ArrayBuffer | Uint8Array;
}

export interface BridgeFrameResult {
  ok: true;
  ignored?: boolean;
  revision: number;
  streamId: string;
  latestRevision?: number | null;
  latestStreamId?: string | null;
  bytes?: number;
  connectedDevices: number;
  devices: BridgeDevice[];
}

interface LatestFrame {
  revision: number;
  streamId: string;
  flags: number;
  payload: Uint8Array;
  packet: Uint8Array;
  receivedAt: number;
}

interface StreamClient {
  id: string;
  socket: net.Socket;
  remoteAddress: string;
  ready: boolean;
  buffer: string;
  connectedAt: number;
  authenticatedAt: number | null;
  lastSentAt: number | null;
  lastRevisionSent: number | null;
  packetsSent: number;
  bytesSent: number;
  awaitingDrain: boolean;
  pendingPacket: Uint8Array | null;
  pendingRevision: number | null;
}

let latestFrame: LatestFrame | null = null;
let nextClientId = 1;
const streamClients = new Set<StreamClient>();
let streamPort = Number.parseInt(process.env.PDPS_STREAM_PORT ?? String(DEFAULT_STREAM_PORT), 10);
let sessionCode = (process.env.PDPS_SESSION ?? DEFAULT_SESSION_CODE).toUpperCase();
let activeHandle: BridgeServerHandle | null = null;
let tcpServer: net.Server | null = null;

export async function startBridge(options: BridgeServerOptions = {}): Promise<BridgeServerHandle> {
  if (activeHandle) return activeHandle;

  streamPort = options.streamPort ?? Number.parseInt(process.env.PDPS_STREAM_PORT ?? String(DEFAULT_STREAM_PORT), 10);
  sessionCode = (options.sessionCode ?? process.env.PDPS_SESSION ?? DEFAULT_SESSION_CODE).toUpperCase();
  tcpServer = createTcpServer();

  try {
    await listen(tcpServer, streamPort, "0.0.0.0");
  } catch (error) {
    await closeServer(tcpServer);
    tcpServer = null;
    throw error;
  }

  console.log(`Playdate Pixel Studio bridge TCP listening on 0.0.0.0:${streamPort}`);
  console.log(`Session ${sessionCode}, LAN candidates: ${getLanAddresses().join(", ") || "none found"}`);

  activeHandle = {
    streamPort,
    sessionCode,
    stop: stopBridge,
    getHealth: healthPayload,
    getSession: sessionPayload,
    getDevices: devicesPayload,
    postFrame,
  };
  return activeHandle;
}

function createTcpServer(): net.Server {
  return net.createServer((socket) => {
    const client: StreamClient = {
      id: `pd-${nextClientId.toString().padStart(2, "0")}`,
      socket,
      remoteAddress: `${socket.remoteAddress ?? "unknown"}:${socket.remotePort ?? "?"}`,
      ready: false,
      buffer: "",
      connectedAt: Date.now(),
      authenticatedAt: null,
      lastSentAt: null,
      lastRevisionSent: null,
      packetsSent: 0,
      bytesSent: 0,
      awaitingDrain: false,
      pendingPacket: null,
      pendingRevision: null,
    };
    nextClientId += 1;
    streamClients.add(client);
    console.log(`Playdate TCP client ${client.id} connected from ${client.remoteAddress}`);

    socket.on("data", (chunk) => {
      if (client.ready) return;
      client.buffer += chunk.toString("utf8");
      const lineEnd = client.buffer.indexOf("\n");
      if (lineEnd === -1) return;

      const line = client.buffer.slice(0, lineEnd).trim();
      if (line !== `HELLO ${sessionCode}`) {
        socket.end(`ERR SESSION\n`);
        return;
      }

      client.ready = true;
      client.authenticatedAt = Date.now();
      socket.write(`OK ${sessionCode}\n`);
      if (latestFrame) writeFrameToClient(client, latestFrame.packet, latestFrame.revision);
      console.log(`Playdate TCP client ${client.id} authenticated from ${client.remoteAddress}`);
    });

    socket.on("drain", () => {
      flushPendingFrame(client);
    });

    socket.on("close", () => {
      streamClients.delete(client);
      console.log(`Playdate TCP client ${client.id} disconnected from ${client.remoteAddress}`);
    });

    socket.on("error", (error) => {
      streamClients.delete(client);
      console.warn(`Playdate TCP client ${client.id} error from ${client.remoteAddress}: ${error.message}`);
    });
  });
}

function postFrame(request: BridgeFrameRequest): BridgeFrameResult {
  const revision = normalizeRevision(request.revision);
  const streamId = normalizeStreamId(request.streamId);
  const flags = normalizeFlags(request.flags);
  const payload = normalizePayload(request.payload);

  const acceptance = shouldAcceptFrameRevision(
    latestFrame ? { revision: latestFrame.revision, streamId: latestFrame.streamId } : null,
    { revision, streamId },
  );

  if (!acceptance.accepted) {
    return {
      ok: true,
      ignored: true,
      revision: acceptance.latestRevision ?? revision,
      streamId,
      latestRevision: acceptance.latestRevision,
      latestStreamId: acceptance.latestStreamId,
      connectedDevices: readyClientCount(),
      devices: readyClientSnapshots(),
    };
  }

  const packet = encodeFramePacket({
    width: PLAYDATE_WIDTH,
    height: PLAYDATE_HEIGHT,
    revision,
    flags,
    payload,
  });

  latestFrame = {
    revision,
    streamId,
    flags,
    payload,
    packet,
    receivedAt: Date.now(),
  };
  broadcast(packet, revision);

  return {
    ok: true,
    revision,
    streamId,
    bytes: payload.byteLength,
    connectedDevices: readyClientCount(),
    devices: readyClientSnapshots(),
  };
}

function broadcast(packet: Uint8Array, revision: number): void {
  for (const client of streamClients) {
    if (!client.ready || client.socket.destroyed) continue;
    writeFrameToClient(client, packet, revision);
  }
}

function writeFrameToClient(client: StreamClient, packet: Uint8Array, revision: number): void {
  if (client.awaitingDrain) {
    client.pendingPacket = packet;
    client.pendingRevision = revision;
    return;
  }

  writeFrameNow(client, packet, revision);
}

function flushPendingFrame(client: StreamClient): void {
  client.awaitingDrain = false;
  if (!client.ready || client.socket.destroyed || !client.pendingPacket || client.pendingRevision === null) return;

  const packet = client.pendingPacket;
  const revision = client.pendingRevision;
  client.pendingPacket = null;
  client.pendingRevision = null;
  writeFrameNow(client, packet, revision);
}

function writeFrameNow(client: StreamClient, packet: Uint8Array, revision: number): void {
  const canAcceptMore = client.socket.write(Buffer.from(packet));
  client.lastSentAt = Date.now();
  client.lastRevisionSent = revision;
  client.packetsSent += 1;
  client.bytesSent += packet.byteLength;
  client.awaitingDrain = !canAcceptMore;
}

function healthPayload(): BridgeHealth {
  return {
    ok: true,
    service: "playdate-pixel-studio-bridge",
    streamPort,
    latestRevision: latestFrame?.revision ?? null,
    latestStreamId: latestFrame?.streamId ?? null,
    latestFrameAgeMs: latestFrame ? Date.now() - latestFrame.receivedAt : null,
    latestFrameBytes: latestFrame?.payload.byteLength ?? null,
    connectedDevices: readyClientCount(),
    devices: readyClientSnapshots(),
  };
}

function sessionPayload(): BridgeSession {
  return {
    sessionCode,
    streamPort,
    hostCandidates: getLanAddresses(),
    latestRevision: latestFrame?.revision ?? null,
    latestStreamId: latestFrame?.streamId ?? null,
    connectedDevices: readyClientCount(),
    devices: readyClientSnapshots(),
  };
}

function devicesPayload(): BridgeDevicesPayload {
  return {
    connectedDevices: readyClientCount(),
    devices: readyClientSnapshots(),
  };
}

function readyClientCount(): number {
  let count = 0;
  for (const client of streamClients) {
    if (client.ready && !client.socket.destroyed) count += 1;
  }
  return count;
}

function readyClientSnapshots(): BridgeDevice[] {
  const now = Date.now();
  return [...streamClients]
    .filter((client) => client.ready && !client.socket.destroyed)
    .map((client) => ({
      id: client.id,
      address: client.remoteAddress,
      connectedForMs: now - client.connectedAt,
      authenticatedForMs: client.authenticatedAt ? now - client.authenticatedAt : null,
      lastFrameAgeMs: client.lastSentAt ? now - client.lastSentAt : null,
      lastRevisionSent: client.lastRevisionSent,
      packetsSent: client.packetsSent,
      bytesSent: client.bytesSent,
    }));
}

function getLanAddresses(): string[] {
  const addresses: string[] = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const entry of interfaces ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return addresses;
}

function listen(server: net.Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

async function stopBridge(): Promise<void> {
  for (const client of streamClients) {
    client.socket.destroy();
  }
  streamClients.clear();
  latestFrame = null;
  activeHandle = null;
  const server = tcpServer;
  tcpServer = null;
  if (server) await closeServer(server);
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function normalizeRevision(revision: number): number {
  if (!Number.isFinite(revision) || revision < 0) {
    throw new Error("Frame revision is invalid.");
  }
  return Math.floor(revision) >>> 0;
}

function normalizeFlags(flags: number | undefined): number {
  if (flags === undefined) return 0;
  if (!Number.isFinite(flags) || flags < 0) throw new Error("Frame flags are invalid.");
  return Math.floor(flags) & 0xff;
}

function normalizePayload(payload: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  if (bytes.byteLength !== PLAYDATE_FRAME_BYTES) {
    throw new Error(`Expected ${PLAYDATE_FRAME_BYTES} frame bytes, received ${bytes.byteLength}.`);
  }
  return new Uint8Array(bytes);
}
