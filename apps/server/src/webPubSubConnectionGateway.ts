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
  }

  detach(roomCode: string, playerId: string) {
    const members = this.roomMembers.get(roomCode);
    if (!members) {
      return;
    }
    members.delete(playerId);
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

    await Promise.all([...members].map((playerId) => this.sendToPlayer(playerId, message)));
  }

  clearRoom(roomCode: string) {
    this.roomMembers.delete(roomCode);
  }
}
