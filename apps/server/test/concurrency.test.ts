import assert from "node:assert/strict";
import test from "node:test";
import { WebSocketConnectionGateway } from "../src/connectionGateway.js";
import { InMemoryRoomDirectory } from "../src/roomDirectory.js";
import { InMemoryRoomMessageBus } from "../src/roomMessageBus.js";
import { InMemoryRoomRepository } from "../src/roomRepository.js";
import { RoomService } from "../src/roomService.js";
import { InMemoryRoomRuntimeRegistry } from "../src/runtimeRegistry.js";

const createServicePair = () => {
  const repository = new InMemoryRoomRepository();
  const directory = new InMemoryRoomDirectory();
  const bus = new InMemoryRoomMessageBus();
  const serviceA = new RoomService(
    repository,
    new InMemoryRoomRuntimeRegistry(),
    new WebSocketConnectionGateway(),
    directory,
    bus,
    "instance-a",
    3600
  );
  const serviceB = new RoomService(
    repository,
    new InMemoryRoomRuntimeRegistry(),
    new WebSocketConnectionGateway(),
    directory,
    bus,
    "instance-b",
    3600
  );
  return { serviceA, serviceB, directory };
};

class FakeSocket {
  static readonly OPEN = 1;
  readonly OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  send(message: string) {
    this.sent.push(message);
  }
}

test("second instance cannot steal ownership from first", async () => {
  const { serviceA, serviceB, directory } = createServicePair();
  const host = await serviceA.createRoom("Host", "azure");

  const owner = await directory.getOwner(host.roomCode);
  assert.equal(owner, "instance-a");

  const claimed = await directory.tryClaimOwner(host.roomCode, "instance-b");
  assert.equal(claimed, false);

  const stillOwner = await directory.getOwner(host.roomCode);
  assert.equal(stillOwner, "instance-a");
});

test("both instances can handle messages for the same room via routing", async () => {
  const { serviceA, serviceB } = createServicePair();
  const host = await serviceA.createRoom("Host", "azure");
  const wing = await serviceB.joinRoom(host.roomCode, "Wing", "emerald");

  const hostSocket = new FakeSocket();
  const wingSocket = new FakeSocket();
  await serviceA.connectPlayer(host.roomCode, host.playerId, hostSocket as never);
  await serviceB.connectPlayer(host.roomCode, wing.playerId, wingSocket as never);

  // Wing's ready message goes through serviceB which should route to owner
  await serviceB.handleMessage(host.roomCode, wing.playerId, { type: "ready", payload: { ready: true } });
  // Give async bus time to process
  await new Promise((resolve) => setImmediate(resolve));

  // Owner (A) should have received the state update
  const hostMessages = hostSocket.sent.map((e) => JSON.parse(e) as { type: string });
  assert.ok(hostMessages.some((m) => m.type === "room_state"));
});

test("lease renewal maintains ownership across ticks", async () => {
  const { serviceA, directory } = createServicePair();
  const host = await serviceA.createRoom("Host", "azure");
  const socket = new FakeSocket();
  await serviceA.connectPlayer(host.roomCode, host.playerId, socket as never);

  // Tick several times to trigger lease renewal
  for (let i = 0; i < 5; i++) {
    await serviceA.tick(50);
  }

  const owner = await directory.getOwner(host.roomCode);
  assert.equal(owner, "instance-a");
});

test("concurrent room creation by different instances produces separate rooms", async () => {
  const { serviceA, serviceB } = createServicePair();

  const [roomA, roomB] = await Promise.all([
    serviceA.createRoom("Alpha", "azure"),
    serviceB.createRoom("Bravo", "crimson")
  ]);

  assert.notEqual(roomA.roomCode, roomB.roomCode);
  assert.equal(roomA.room.players[0]?.name, "Alpha");
  assert.equal(roomB.room.players[0]?.name, "Bravo");
});

test("concurrent join attempts do not exceed max players", async () => {
  const { serviceA, serviceB } = createServicePair();
  const host = await serviceA.createRoom("Host", "azure");

  // Fill to 3 players (max is 4)
  await serviceA.joinRoom(host.roomCode, "Wing1", "emerald");
  await serviceA.joinRoom(host.roomCode, "Wing2", "crimson");

  // Two concurrent joins for the last slot — one should succeed, one should fail
  const results = await Promise.allSettled([
    serviceA.joinRoom(host.roomCode, "Wing3", "azure"),
    serviceB.joinRoom(host.roomCode, "Wing4", "emerald")
  ]);

  const successes = results.filter((r) => r.status === "fulfilled");
  const failures = results.filter((r) => r.status === "rejected");
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
});
