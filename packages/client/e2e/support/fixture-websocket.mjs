// @ts-check
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { assertLoopbackWebSocket } from "./loopback-websocket.mjs";

const require = createRequire(
  new URL("../../../server/package.json", import.meta.url),
);
const directory = dirname(require.resolve("ws/package.json"));
const OriginalWebSocket = require(join(directory, "lib/websocket.js"));

export class WebSocket extends OriginalWebSocket {
  /** @param {unknown[]} args */
  constructor(...args) {
    if (args[0] !== null) assertLoopbackWebSocket(args[0]);
    const options = args[2] ?? args[1];
    if (
      options &&
      typeof options === "object" &&
      (("followRedirects" in options && options.followRedirects) ||
        "createConnection" in options)
    ) {
      throw new Error(
        "E2E WebSocket loopback guard forbids redirects and custom sockets",
      );
    }
    super(...args);
  }
}

export const WebSocketServer = require(
  join(directory, "lib/websocket-server.js"),
);
export const createWebSocketStream = require(join(directory, "lib/stream.js"));
export const Receiver = require(join(directory, "lib/receiver.js"));
export const Sender = require(join(directory, "lib/sender.js"));
export const extension = require(join(directory, "lib/extension.js"));
export const subprotocol = require(join(directory, "lib/subprotocol.js"));
Object.assign(WebSocket, {
  WebSocket,
  WebSocketServer,
  Server: WebSocketServer,
  createWebSocketStream,
  Receiver,
  Sender,
});
export default WebSocket;
export { WebSocket as "module.exports" };
