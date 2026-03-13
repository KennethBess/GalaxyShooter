import { WebPubSubServiceClient } from "@azure/web-pubsub";
import type { ServerMessage } from "@shared/index";
import type { ConnectionGateway } from "./connectionGateway.js";
import { logError, logInfo } from "./logger.js";

export class WebPubSubConnectionGateway implements ConnectionGateway {
  private readonly roomMembers = new Map<string, Set<string>>();

  constructor(private readonly serviceClient: WebPubSubServiceClient) {}

  attach(roomCode: string, playerId: string) {
    const members = this.roomMembers.get(roomCode) ?? new Set<string>();
    members.add(playerId);
    this.roomMembers.set(roomCode, members);
    logInfo("Attached realtime room member", {
      roomCode,
      playerId,
      memberCount: members.size
    });
    // Join the player to the room group so broadcastToRoom can use sendToGroup
    void this.serviceClient.addUserToGroup(roomCode, playerId).catch((error) => {
      logError("Failed to add player to Web PubSub group", error, { roomCode, playerId });
    });
  }

  detach(roomCode: string, playerId: string) {
    const members = this.roomMembers.get(roomCode);
    if (!members) {
      return;
    }
    members.delete(playerId);
    // Remove player from the room group
    void this.serviceClient.removeUserFromGroup(roomCode, playerId).catch((error) => {
      logError("Failed to remove player from Web PubSub group", error, { roomCode, playerId });
    });
    if (members.size === 0) {
      this.roomMembers.delete(roomCode);
      logInfo("Detached last realtime room member", { roomCode, playerId });
      return;
    }

    logInfo("Detached realtime room member", {
      roomCode,
      playerId,
      memberCount: members.size
    });
  }

  private static readonly SEND_TIMEOUT_MS = 2_000;

  async sendToPlayer(playerId: string, message: ServerMessage) {
    try {
      await this.serviceClient.sendToUser(playerId, message, {
        abortSignal: AbortSignal.timeout(WebPubSubConnectionGateway.SEND_TIMEOUT_MS)
      });
    } catch (error) {
      logError("Failed to deliver realtime message to player", error, {
        playerId,
        messageType: message.type
      });
    }
  }

  async broadcastToRoom(roomCode: string, message: ServerMessage) {
    const members = this.roomMembers.get(roomCode);
    if (!members || members.size === 0) {
      return;
    }

    try {
      await this.serviceClient.sendToGroup(roomCode, message, "json", {
        abortSignal: AbortSignal.timeout(WebPubSubConnectionGateway.SEND_TIMEOUT_MS)
      });
    } catch (error) {
      logError("Failed to broadcast realtime message to room", error, {
        roomCode,
        messageType: message.type
      });
    }
  }

  clearRoom(roomCode: string) {
    this.roomMembers.delete(roomCode);
  }
}
