import { WebSocketConnectionGateway } from "../src/connectionGateway.js";
import { InMemoryRoomDirectory } from "../src/roomDirectory.js";
import { RoomManager } from "../src/roomManager.js";
import { InMemoryRoomMessageBus } from "../src/roomMessageBus.js";
import { InMemoryRoomRepository } from "../src/roomRepository.js";
import { RoomService } from "../src/roomService.js";
import { InMemoryRoomRuntimeRegistry } from "../src/runtimeRegistry.js";

export class FakeSocket {
  static readonly OPEN = 1;
  readonly OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  send(message: string) {
    this.sent.push(message);
  }
}

export const createTestManager = () =>
  new RoomManager(
    new RoomService(
      new InMemoryRoomRepository(),
      new InMemoryRoomRuntimeRegistry(),
      new WebSocketConnectionGateway(),
      new InMemoryRoomDirectory(),
      new InMemoryRoomMessageBus(),
      "local",
      3600
    )
  );

export const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

export const parseMessages = <T>(socket: FakeSocket) =>
  socket.sent.map((entry) => JSON.parse(entry) as T);
