import type WebSocket from "ws";
import { TICK_RATE, type ClientMessage, type OpenRoomSummary, type RoomState, type RoomSummary } from "../../../packages/shared/src/index.js";
import { WebSocketConnectionGateway } from "./connectionGateway.js";
import { InMemoryRoomDirectory } from "./roomDirectory.js";
import { InMemoryRoomMessageBus } from "./roomMessageBus.js";
import { InMemoryRoomRepository } from "./roomRepository.js";
import { RoomService } from "./roomService.js";
import { InMemoryRoomRuntimeRegistry } from "./runtimeRegistry.js";

export class RoomManager {
  constructor(
    private readonly service = new RoomService(
      new InMemoryRoomRepository(),
      new InMemoryRoomRuntimeRegistry(),
      new WebSocketConnectionGateway(),
      new InMemoryRoomDirectory(),
      new InMemoryRoomMessageBus(),
      "local",
      3600
    )
  ) {}

  createRoom(playerName: string, shipId?: string): Promise<RoomSummary> {
    return this.service.createRoom(playerName, shipId);
  }

  joinRoom(roomCode: string, playerName: string, shipId?: string): Promise<RoomSummary> {
    return this.service.joinRoom(roomCode, playerName, shipId);
  }

  listOpenRooms(): Promise<OpenRoomSummary[]> {
    return this.service.listOpenRooms();
  }

  validatePlayer(roomCode: string, playerId: string): Promise<RoomState> {
    return this.service.validatePlayer(roomCode, playerId);
  }

  connectPlayer(roomCode: string, playerId: string, socket?: WebSocket): Promise<RoomState> {
    return this.service.connectPlayer(roomCode, playerId, socket);
  }

  disconnectPlayer(roomCode: string, playerId: string): Promise<void> {
    return this.service.disconnectPlayer(roomCode, playerId);
  }

  handleMessage(roomCode: string, playerId: string, message: ClientMessage): Promise<void> {
    return this.service.handleMessage(roomCode, playerId, message);
  }

  tick(deltaMs: number = 1000 / TICK_RATE): Promise<void> {
    return this.service.tick(deltaMs);
  }
}
