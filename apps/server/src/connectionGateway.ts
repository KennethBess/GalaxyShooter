import { WebSocket } from "ws";
import type { ServerMessage } from "../../../packages/shared/src/index.js";

export interface ConnectionGateway {
  attach(roomCode: string, playerId: string, socket?: WebSocket): void;
  detach(roomCode: string, playerId: string): void;
  sendToPlayer(playerId: string, message: ServerMessage): Promise<void>;
  broadcastToRoom(roomCode: string, message: ServerMessage): Promise<void>;
  clearRoom(roomCode: string): void;
}

export class WebSocketConnectionGateway implements ConnectionGateway {
  private readonly sockets = new Map<string, WebSocket>();
  private readonly roomMembers = new Map<string, Set<string>>();

  attach(roomCode: string, playerId: string, socket?: WebSocket) {
    if (!socket) {
      throw new Error("Direct socket transport requires a WebSocket connection");
    }

    this.sockets.set(playerId, socket);
    const members = this.roomMembers.get(roomCode) ?? new Set<string>();
    members.add(playerId);
    this.roomMembers.set(roomCode, members);
  }

  detach(roomCode: string, playerId: string) {
    this.sockets.delete(playerId);
    const members = this.roomMembers.get(roomCode);
    if (!members) {
      return;
    }
    members.delete(playerId);
    if (members.size === 0) {
      this.roomMembers.delete(roomCode);
    }
  }

  async sendToPlayer(playerId: string, message: ServerMessage) {
    const socket = this.sockets.get(playerId);
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  async broadcastToRoom(roomCode: string, message: ServerMessage) {
    const members = this.roomMembers.get(roomCode);
    if (!members || members.size === 0) {
      return;
    }
    const encoded = JSON.stringify(message);
    for (const playerId of members) {
      const socket = this.sockets.get(playerId);
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(encoded);
      }
    }
  }

  clearRoom(roomCode: string) {
    const members = this.roomMembers.get(roomCode);
    if (members) {
      for (const playerId of members) {
        this.sockets.delete(playerId);
      }
    }
    this.roomMembers.delete(roomCode);
  }
}
