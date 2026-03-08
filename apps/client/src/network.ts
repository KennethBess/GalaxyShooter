import type { ClientMessage, ServerMessage } from "@shared/index";
import { apiBase, negotiateRealtime } from "./api";

const WS_BASE = (import.meta.env.VITE_WS_BASE as string | undefined) ?? apiBase.replace(/^http/, "ws");
const WEB_PUBSUB_PROTOCOL = "json.webpubsub.azure.v1";

type RealtimeMode = "direct" | "webpubsub";

type WebPubSubEnvelope =
  | { type: "ack"; ackId: number; success: boolean; error?: { name?: string; message?: string } }
  | { type: "system"; event: string; connectionId?: string; userId?: string }
  | { type: "message"; from: string; dataType: "json" | "text" | "binary"; data: unknown };

export class RoomConnection {
  private socket?: WebSocket;
  private mode: RealtimeMode = "direct";
  private ackId = 1;
  private readonly pendingMessages: ClientMessage[] = [];

  constructor(private readonly roomCode: string, private readonly playerId: string) {}

  async connect(onMessage: (message: ServerMessage) => void, onClose: () => void) {
    const negotiation = await negotiateRealtime({ roomCode: this.roomCode, playerId: this.playerId });
    this.mode = negotiation.mode;

    if (negotiation.mode === "direct") {
      await this.openSocket(negotiation.url || this.buildDirectUrl(), undefined, onMessage, onClose);
      return;
    }

    await this.openSocket(negotiation.url, WEB_PUBSUB_PROTOCOL, onMessage, onClose);
  }

  send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendNow(message);
      return;
    }

    this.pendingMessages.push(message);
  }

  disconnect() {
    this.pendingMessages.length = 0;
    this.socket?.close();
    this.socket = undefined;
  }

  private buildDirectUrl() {
    const url = new URL("/rooms", WS_BASE);
    url.searchParams.set("code", this.roomCode);
    url.searchParams.set("playerId", this.playerId);
    return url.toString();
  }

  private async openSocket(
    url: string,
    protocol: string | undefined,
    onMessage: (message: ServerMessage) => void,
    onClose: () => void
  ) {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const socket = protocol ? new WebSocket(url, protocol) : new WebSocket(url);
      this.socket = socket;

      socket.addEventListener("open", () => {
        settled = true;
        this.flushPending();
        resolve();
      });

      socket.addEventListener("message", (event) => {
        this.handleIncomingMessage(event.data, onMessage);
      });

      socket.addEventListener("error", () => {
        if (!settled) {
          settled = true;
          reject(new Error("Realtime connection failed"));
        }
      });

      socket.addEventListener("close", () => {
        this.socket = undefined;
        if (!settled) {
          settled = true;
          reject(new Error("Realtime connection closed before ready"));
          return;
        }
        onClose();
      });
    });
  }

  private flushPending() {
    while (this.pendingMessages.length > 0) {
      const nextMessage = this.pendingMessages.shift();
      if (nextMessage) {
        this.sendNow(nextMessage);
      }
    }
  }

  private sendNow(message: ClientMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (this.mode === "webpubsub") {
      this.socket.send(JSON.stringify({
        type: "event",
        event: "client-message",
        dataType: "json",
        data: message,
        ackId: this.ackId++
      }));
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  private handleIncomingMessage(rawData: unknown, onMessage: (message: ServerMessage) => void) {
    const text = typeof rawData === "string" ? rawData : rawData instanceof Blob ? undefined : String(rawData);
    if (!text) {
      return;
    }

    const payload = JSON.parse(text) as ServerMessage | WebPubSubEnvelope;
    if (!this.isWebPubSubEnvelope(payload)) {
      onMessage(payload);
      return;
    }

    if (payload.type === "message" && payload.dataType === "json" && this.isServerMessage(payload.data)) {
      onMessage(payload.data);
    }
  }

  private isWebPubSubEnvelope(value: ServerMessage | WebPubSubEnvelope): value is WebPubSubEnvelope {
    return typeof value === "object" && value !== null && "type" in value && ["ack", "system", "message"].includes(String(value.type));
  }

  private isServerMessage(value: unknown): value is ServerMessage {
    return typeof value === "object" && value !== null && "type" in value;
  }
}
