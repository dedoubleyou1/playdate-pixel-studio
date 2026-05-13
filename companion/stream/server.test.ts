/// <reference types="node" />

import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { PLAYDATE_FRAME_BYTES } from "../../src/companion/protocol";
import { startPlaydateStreamServer, type PlaydateStreamServerHandle } from "./server";

let stream: PlaydateStreamServerHandle | null = null;

afterEach(async () => {
  if (stream) {
    await stream.stop();
    stream = null;
  }
});

describe("Playdate TCP stream service", () => {
  it("starts, reports session and health, and stops", async () => {
    const port = await getAvailablePort();
    stream = await startPlaydateStreamServer({ streamPort: port, sessionCode: "TEST01" });

    expect(stream.getSession()).toMatchObject({
      sessionCode: "TEST01",
      streamPort: port,
      latestRevision: null,
      connectedDevices: 0,
    });
    expect(stream.getHealth()).toMatchObject({
      ok: true,
      streamPort: port,
      latestFrameBytes: null,
      connectedDevices: 0,
    });

    await stream.stop();
    stream = null;
  });

  it("releases the TCP port so streaming can restart cleanly", async () => {
    const port = await getAvailablePort();
    const firstStream = await startPlaydateStreamServer({ streamPort: port, sessionCode: "TEST03" });

    expect(firstStream.getSession()).toMatchObject({ sessionCode: "TEST03", streamPort: port });

    await firstStream.stop();
    stream = await startPlaydateStreamServer({ streamPort: port, sessionCode: "TEST04" });

    expect(stream).not.toBe(firstStream);
    expect(stream.getSession()).toMatchObject({ sessionCode: "TEST04", streamPort: port });
  });

  it("tracks authenticated devices and broadcasts accepted frames", async () => {
    const port = await getAvailablePort();
    stream = await startPlaydateStreamServer({ streamPort: port, sessionCode: "TEST02" });
    const socket = await connectPlaydateClient(port, "TEST02");

    expect(stream.getDevices().connectedDevices).toBe(1);

    const result = stream.postFrame({
      revision: 3,
      streamId: "stream-a",
      flags: 0,
      payload: new Uint8Array(PLAYDATE_FRAME_BYTES),
    });

    expect(result).toMatchObject({ ok: true, revision: 3, streamId: "stream-a", connectedDevices: 1 });
    expect(stream.getHealth()).toMatchObject({ latestRevision: 3, latestFrameBytes: PLAYDATE_FRAME_BYTES });
    expect(stream.getDevices().devices[0]).toMatchObject({ lastRevisionSent: 3, packetsSent: 1 });

    socket.destroy();
  });

  it("rejects stale revisions within a stream but accepts a new stream generation", async () => {
    const port = await getAvailablePort();
    stream = await startPlaydateStreamServer({ streamPort: port });

    stream.postFrame({
      revision: 12,
      streamId: "stream-a",
      flags: 0,
      payload: new Uint8Array(PLAYDATE_FRAME_BYTES),
    });
    const stale = stream.postFrame({
      revision: 4,
      streamId: "stream-a",
      flags: 0,
      payload: new Uint8Array(PLAYDATE_FRAME_BYTES),
    });
    const nextStream = stream.postFrame({
      revision: 0,
      streamId: "stream-b",
      flags: 0,
      payload: new Uint8Array(PLAYDATE_FRAME_BYTES),
    });

    expect(stale).toMatchObject({ ignored: true, revision: 12, latestStreamId: "stream-a" });
    expect(nextStream).toMatchObject({ ok: true, revision: 0, streamId: "stream-b" });
    expect(stream.getHealth()).toMatchObject({ latestRevision: 0, latestStreamId: "stream-b" });
  });

  it("reports port bind failures", async () => {
    const port = await getAvailablePort();
    const blocker = await listenOnPort(port);

    await expect(startPlaydateStreamServer({ streamPort: port })).rejects.toThrow(/EADDRINUSE|address already in use/i);
    blocker.close();
  });
});

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to allocate a TCP port."));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function listenOnPort(port: number): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => {
      resolve(server);
    });
  });
}

function connectPlaydateClient(port: number, sessionCode: string): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("error", reject);
    socket.once("connect", () => {
      socket.write(`HELLO ${sessionCode}\n`);
    });
    socket.once("data", (chunk) => {
      const response = chunk.toString("utf8");
      if (!response.startsWith(`OK ${sessionCode}`)) {
        reject(new Error(`Unexpected stream response: ${response}`));
        socket.destroy();
        return;
      }
      resolve(socket);
    });
  });
}
