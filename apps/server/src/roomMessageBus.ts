import { EventEmitter } from "node:events";
import type { RedisClientType } from "redis";
import type { ClientMessage, ServerMessage } from "../../../packages/shared/src/index.js";
import { normalizeRoomCode } from "./runtime.js";

export interface RoomCommandEnvelope {
  roomCode: string;
  playerId: string;
  message: ClientMessage;
}

export interface RoomEventEnvelope {
  roomCode: string;
  originInstanceId: string;
  messages: ServerMessage[];
}

export interface RoomMessageBus {
  publishCommand(command: RoomCommandEnvelope): Promise<void>;
  publishEvents(event: RoomEventEnvelope): Promise<void>;
  onCommand(handler: (command: RoomCommandEnvelope) => void | Promise<void>): void;
  onEvent(handler: (event: RoomEventEnvelope) => void | Promise<void>): void;
  close(): Promise<void>;
}

const COMMAND_EVENT = "command";
const ROOM_EVENT = "room-event";
const COMMAND_CHANNEL = "galaxy:room:commands";
const EVENT_CHANNEL = "galaxy:room:events";

export class InMemoryRoomMessageBus implements RoomMessageBus {
  private readonly emitter = new EventEmitter();

  async publishCommand(command: RoomCommandEnvelope) {
    this.emitter.emit(COMMAND_EVENT, { ...command, roomCode: normalizeRoomCode(command.roomCode) });
  }

  async publishEvents(event: RoomEventEnvelope) {
    this.emitter.emit(ROOM_EVENT, { ...event, roomCode: normalizeRoomCode(event.roomCode) });
  }

  onCommand(handler: (command: RoomCommandEnvelope) => void | Promise<void>) {
    this.emitter.on(COMMAND_EVENT, (command: RoomCommandEnvelope) => {
      void handler(command);
    });
  }

  onEvent(handler: (event: RoomEventEnvelope) => void | Promise<void>) {
    this.emitter.on(ROOM_EVENT, (event: RoomEventEnvelope) => {
      void handler(event);
    });
  }

  async close() {}
}

export class RedisRoomMessageBus implements RoomMessageBus {
  private commandHandler?: (command: RoomCommandEnvelope) => void | Promise<void>;
  private eventHandler?: (event: RoomEventEnvelope) => void | Promise<void>;

  constructor(
    private readonly pubClient: RedisClientType,
    private readonly subClient: RedisClientType
  ) {}

  async initialize() {
    await this.subClient.subscribe(COMMAND_CHANNEL, (raw) => {
      if (!this.commandHandler) {
        return;
      }
      void this.commandHandler(JSON.parse(raw) as RoomCommandEnvelope);
    });
    await this.subClient.subscribe(EVENT_CHANNEL, (raw) => {
      if (!this.eventHandler) {
        return;
      }
      void this.eventHandler(JSON.parse(raw) as RoomEventEnvelope);
    });
  }

  async publishCommand(command: RoomCommandEnvelope) {
    await this.pubClient.publish(COMMAND_CHANNEL, JSON.stringify({
      ...command,
      roomCode: normalizeRoomCode(command.roomCode)
    }));
  }

  async publishEvents(event: RoomEventEnvelope) {
    await this.pubClient.publish(EVENT_CHANNEL, JSON.stringify({
      ...event,
      roomCode: normalizeRoomCode(event.roomCode)
    }));
  }

  onCommand(handler: (command: RoomCommandEnvelope) => void | Promise<void>) {
    if (this.commandHandler) {
      console.warn("RedisRoomMessageBus: overwriting existing command handler");
    }
    this.commandHandler = handler;
  }

  onEvent(handler: (event: RoomEventEnvelope) => void | Promise<void>) {
    if (this.eventHandler) {
      console.warn("RedisRoomMessageBus: overwriting existing event handler");
    }
    this.eventHandler = handler;
  }

  async close() {
    await this.subClient.unsubscribe(COMMAND_CHANNEL);
    await this.subClient.unsubscribe(EVENT_CHANNEL);
  }
}
