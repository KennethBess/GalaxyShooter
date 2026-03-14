import { type ClientMessage, type OpenRoomSummary, type RoomState, type RoomSummary, TICK_RATE } from "@shared/index";
import type WebSocket from "ws";
import { RoomService } from "./roomService.js";

export class RoomManager {
  constructor(
    private readonly service: RoomService
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

  connectController(roomCode: string, targetPlayerId: string, controllerId: string): Promise<string> {
    return this.service.connectController(roomCode, targetPlayerId, controllerId);
  }

  disconnectController(controllerId: string): void {
    this.service.disconnectController(controllerId);
  }

  handleControllerMessage(controllerId: string, message: ClientMessage): Promise<void> {
    return this.service.handleControllerMessage(controllerId, message);
  }

  tick(deltaMs: number = 1000 / TICK_RATE): Promise<void> {
    return this.service.tick(deltaMs);
  }
}
