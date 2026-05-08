import http from "node:http";
import net from "node:net";
import os from "node:os";
import { URL } from "node:url";
import { encodeFramePacket, PLAYDATE_FRAME_BYTES } from "../../src/companion/protocol.ts";
import {
  normalizeStreamId,
  PDPS_FRAME_REQUEST_HEADERS,
  PDPS_STREAM_ID_HEADER,
  shouldAcceptFrameRevision,
} from "../../src/companion/streamMetadata.ts";
import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../../src/domain/constants.ts";

const CONTROL_PORT = Number.parseInt(process.env.PDPS_CONTROL_PORT ?? "9137", 10);
const STREAM_PORT = Number.parseInt(process.env.PDPS_STREAM_PORT ?? "9138", 10);
const DEFAULT_SESSION_CODE = "ABC123";
const SESSION_CODE = (process.env.PDPS_SESSION ?? DEFAULT_SESSION_CODE).toUpperCase();
const ALLOWED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/;

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

const httpServer = http.createServer((request, response) => {
  const origin = request.headers.origin;
  if (origin && !ALLOWED_ORIGIN.test(origin)) {
    writeJson(response, 403, { ok: false, error: "Origin is not allowed." });
    return;
  }

  setCorsHeaders(response, origin);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

  if (request.method === "GET" && url.pathname === "/v1/health") {
    writeJson(response, 200, healthPayload());
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/session") {
    writeJson(response, 200, {
      sessionCode: SESSION_CODE,
      controlPort: CONTROL_PORT,
      streamPort: STREAM_PORT,
      hostCandidates: getLanAddresses(),
      latestRevision: latestFrame?.revision ?? null,
      latestStreamId: latestFrame?.streamId ?? null,
      connectedDevices: readyClientCount(),
      devices: readyClientSnapshots(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/devices") {
    writeJson(response, 200, {
      connectedDevices: readyClientCount(),
      devices: readyClientSnapshots(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/frame.bin") {
    if (!latestFrame) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: "No frame has been posted yet." }));
      return;
    }
    response.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": latestFrame.packet.byteLength,
      "x-pdps-revision": String(latestFrame.revision),
      [PDPS_STREAM_ID_HEADER]: latestFrame.streamId,
    });
    response.end(Buffer.from(latestFrame.packet));
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/frame") {
    void receiveFrame(request, response);
    return;
  }

  writeJson(response, 404, { ok: false, error: "Unknown endpoint." });
});

const tcpServer = net.createServer((socket) => {
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
    if (line !== `HELLO ${SESSION_CODE}`) {
      socket.end(`ERR SESSION\n`);
      return;
    }

    client.ready = true;
    client.authenticatedAt = Date.now();
    socket.write(`OK ${SESSION_CODE}\n`);
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

httpServer.listen(CONTROL_PORT, "0.0.0.0", () => {
  console.log(`Playdate Pixel Studio bridge HTTP listening on http://127.0.0.1:${CONTROL_PORT}`);
  console.log(`Session ${SESSION_CODE}, LAN candidates: ${getLanAddresses().join(", ") || "none found"}`);
});

tcpServer.listen(STREAM_PORT, "0.0.0.0", () => {
  console.log(`Playdate Pixel Studio bridge TCP listening on 0.0.0.0:${STREAM_PORT}`);
});

async function receiveFrame(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
  try {
    const body = await readRequestBody(request, PLAYDATE_FRAME_BYTES);
    const revision = Number.parseInt(String(request.headers["x-pdps-revision"] ?? "0"), 10);
    const streamId = normalizeStreamId(request.headers[PDPS_STREAM_ID_HEADER]);
    const flags = Number.parseInt(String(request.headers["x-pdps-flags"] ?? "0"), 10);

    if (!Number.isFinite(revision) || revision < 0) {
      writeJson(response, 400, { ok: false, error: "Frame revision is invalid." });
      return;
    }

    const acceptance = shouldAcceptFrameRevision(
      latestFrame ? { revision: latestFrame.revision, streamId: latestFrame.streamId } : null,
      { revision, streamId },
    );

    if (!acceptance.accepted) {
      writeJson(response, 202, {
        ok: true,
        ignored: true,
        revision: acceptance.latestRevision,
        streamId,
        latestRevision: acceptance.latestRevision,
        latestStreamId: acceptance.latestStreamId,
        connectedDevices: readyClientCount(),
        devices: readyClientSnapshots(),
      });
      return;
    }

    const packet = encodeFramePacket({
      width: PLAYDATE_WIDTH,
      height: PLAYDATE_HEIGHT,
      revision,
      flags,
      payload: body,
    });

    latestFrame = {
      revision,
      streamId,
      flags,
      payload: body,
      packet,
      receivedAt: Date.now(),
    };
    broadcast(packet, revision);
    writeJson(response, 200, {
      ok: true,
      revision,
      streamId,
      bytes: body.byteLength,
      connectedDevices: readyClientCount(),
      devices: readyClientSnapshots(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read frame.";
    writeJson(response, 400, { ok: false, error: message });
  }
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

function readRequestBody(request: http.IncomingMessage, expectedBytes: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    request.on("data", (chunk: Buffer) => {
      total += chunk.byteLength;
      if (total > expectedBytes) {
        reject(new Error(`Frame payload is larger than ${expectedBytes} bytes.`));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      const body = Buffer.concat(chunks);
      if (body.byteLength !== expectedBytes) {
        reject(new Error(`Expected ${expectedBytes} bytes, received ${body.byteLength}.`));
        return;
      }
      resolve(new Uint8Array(body));
    });

    request.on("error", reject);
  });
}

function healthPayload(): Record<string, unknown> {
  return {
    ok: true,
    service: "playdate-pixel-studio-bridge",
    controlPort: CONTROL_PORT,
    streamPort: STREAM_PORT,
    latestRevision: latestFrame?.revision ?? null,
    latestStreamId: latestFrame?.streamId ?? null,
    latestFrameAgeMs: latestFrame ? Date.now() - latestFrame.receivedAt : null,
    latestFrameBytes: latestFrame?.payload.byteLength ?? null,
    connectedDevices: readyClientCount(),
    devices: readyClientSnapshots(),
  };
}

function writeJson(response: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

function setCorsHeaders(response: http.ServerResponse, origin: string | undefined): void {
  if (origin) response.setHeader("access-control-allow-origin", origin);
  response.setHeader("vary", "origin");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", PDPS_FRAME_REQUEST_HEADERS.join(","));
}

function readyClientCount(): number {
  let count = 0;
  for (const client of streamClients) {
    if (client.ready && !client.socket.destroyed) count += 1;
  }
  return count;
}

function readyClientSnapshots(): Array<Record<string, unknown>> {
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
