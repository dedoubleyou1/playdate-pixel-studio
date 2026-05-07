import http from "node:http";
import net from "node:net";
import os from "node:os";
import { URL } from "node:url";
import { encodeFramePacket, PLAYDATE_FRAME_BYTES } from "../../src/companion/protocol.ts";
import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../../src/domain/constants.ts";

const CONTROL_PORT = Number.parseInt(process.env.PDPS_CONTROL_PORT ?? "9137", 10);
const STREAM_PORT = Number.parseInt(process.env.PDPS_STREAM_PORT ?? "9138", 10);
const DEFAULT_SESSION_CODE = "ABC123";
const SESSION_CODE = (process.env.PDPS_SESSION ?? DEFAULT_SESSION_CODE).toUpperCase();
const ALLOWED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/;

interface LatestFrame {
  revision: number;
  flags: number;
  payload: Uint8Array;
  packet: Uint8Array;
  receivedAt: number;
}

interface StreamClient {
  socket: net.Socket;
  remoteAddress: string;
  ready: boolean;
  buffer: string;
}

let latestFrame: LatestFrame | null = null;
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
      connectedDevices: readyClientCount(),
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
    socket,
    remoteAddress: `${socket.remoteAddress ?? "unknown"}:${socket.remotePort ?? "?"}`,
    ready: false,
    buffer: "",
  };
  streamClients.add(client);
  console.log(`Playdate TCP client connected from ${client.remoteAddress}`);

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
    socket.write(`OK ${SESSION_CODE}\n`);
    if (latestFrame) socket.write(Buffer.from(latestFrame.packet));
    console.log(`Playdate TCP client authenticated from ${client.remoteAddress}`);
  });

  socket.on("close", () => {
    streamClients.delete(client);
    console.log(`Playdate TCP client disconnected from ${client.remoteAddress}`);
  });

  socket.on("error", (error) => {
    streamClients.delete(client);
    console.warn(`Playdate TCP client error from ${client.remoteAddress}: ${error.message}`);
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
    const flags = Number.parseInt(String(request.headers["x-pdps-flags"] ?? "0"), 10);

    if (!Number.isFinite(revision) || revision < 0) {
      writeJson(response, 400, { ok: false, error: "Frame revision is invalid." });
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
      flags,
      payload: body,
      packet,
      receivedAt: Date.now(),
    };
    broadcast(packet);
    writeJson(response, 200, {
      ok: true,
      revision,
      bytes: body.byteLength,
      connectedDevices: readyClientCount(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read frame.";
    writeJson(response, 400, { ok: false, error: message });
  }
}

function broadcast(packet: Uint8Array): void {
  const buffer = Buffer.from(packet);
  for (const client of streamClients) {
    if (!client.ready || client.socket.destroyed) continue;
    client.socket.write(buffer);
  }
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
    latestFrameAgeMs: latestFrame ? Date.now() - latestFrame.receivedAt : null,
    latestFrameBytes: latestFrame?.payload.byteLength ?? null,
    connectedDevices: readyClientCount(),
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
  response.setHeader("access-control-allow-headers", "content-type,x-pdps-revision,x-pdps-flags,x-pdps-crc32");
}

function readyClientCount(): number {
  let count = 0;
  for (const client of streamClients) {
    if (client.ready && !client.socket.destroyed) count += 1;
  }
  return count;
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
