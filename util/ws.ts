import ws, { WebSocketServer } from "ws";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { app, createContext } from "../resources/_app";

declare global {
  var wss: WebSocketServer;
}

if (globalThis.wss) {
  globalThis.wss.close();
}

const wss = new ws.Server({ port: 3002 });
globalThis.wss = wss;

const handler = applyWSSHandler({ wss, router: app, createContext });

process.on("SIGTERM", () => {
  handler.broadcastReconnectNotification();
  wss.close();
});
