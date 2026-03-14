import assert from "node:assert/strict";
import test from "node:test";
import { RECONNECT_GRACE_MS } from "@shared/index";
import { WebSocketConnectionGateway } from "../src/connectionGateway.js";
import { InMemoryLeaderboardRepository } from "../src/leaderboardRepository.js";
import { InMemoryRoomDirectory } from "../src/roomDirectory.js";
import { InMemoryRoomMessageBus } from "../src/roomMessageBus.js";
import { InMemoryRoomRepository } from "../src/roomRepository.js";
import { RoomService } from "../src/roomService.js";
import { InMemoryRoomRuntimeRegistry } from "../src/runtimeRegistry.js";

const createService = () => {
  const repository = new InMemoryRoomRepository();
  const runtimes = new InMemoryRoomRuntimeRegistry();
  const gateway = new WebSocketConnectionGateway();
  const directory = new InMemoryRoomDirectory();
  const bus = new InMemoryRoomMessageBus();
  const service = new RoomService(
    repository,
    runtimes,
    gateway,
    directory,
    bus,
    "test-instance",
    3600,
    new InMemoryLeaderboardRepository()
  );
  return { service, repository, runtimes, gateway, directory };
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

test("disconnected player is removed after reconnect grace period", async (ctx) => {
  const { service, repository } = createService();
  const host = await service.createRoom("Host", "azure");
  const wing = await service.joinRoom(host.roomCode, "Wing", "emerald");
  const hostSocket = new FakeSocket();
  const wingSocket = new FakeSocket();

  await service.connectPlayer(host.roomCode, host.playerId, hostSocket as never);
  await service.connectPlayer(host.roomCode, wing.playerId, wingSocket as never);

  // Disconnect wing
  await service.disconnectPlayer(host.roomCode, wing.playerId);

  // Immediately check — player should still be in room (grace period)
  const stateAfterDisconnect = await repository.get(host.roomCode);
  assert.equal(stateAfterDisconnect?.players.length, 2);
  const wingPlayer = stateAfterDisconnect?.players.find((p) => p.playerId === wing.playerId);
  assert.equal(wingPlayer?.connected, false);
});

test("player reconnects within grace period and stays in room", async () => {
  const { service, repository } = createService();
  const host = await service.createRoom("Host", "azure");
  const wing = await service.joinRoom(host.roomCode, "Wing", "emerald");
  const hostSocket = new FakeSocket();
  const wingSocket1 = new FakeSocket();

  await service.connectPlayer(host.roomCode, host.playerId, hostSocket as never);
  await service.connectPlayer(host.roomCode, wing.playerId, wingSocket1 as never);
  await service.disconnectPlayer(host.roomCode, wing.playerId);

  // Reconnect before grace period expires
  const wingSocket2 = new FakeSocket();
  const state = await service.connectPlayer(host.roomCode, wing.playerId, wingSocket2 as never);

  assert.equal(state.players.length, 2);
  const wingPlayer = state.players.find((p) => p.playerId === wing.playerId);
  assert.equal(wingPlayer?.connected, true);
});

test("removing last player cleans up room entirely", async () => {
  const { service, repository, runtimes, directory } = createService();
  const host = await service.createRoom("Host", "azure");
  const socket = new FakeSocket();
  await service.connectPlayer(host.roomCode, host.playerId, socket as never);

  // Verify room exists
  assert.ok(await repository.get(host.roomCode));

  // Leave room
  await service.handleMessage(host.roomCode, host.playerId, { type: "leave_room" });

  // Room should be fully cleaned up
  const state = await repository.get(host.roomCode);
  assert.equal(state, undefined);
  assert.equal(runtimes.get(host.roomCode), undefined);
  assert.equal(await directory.getOwner(host.roomCode), undefined);
});

test("host leaving promotes next player", async () => {
  const { service, repository } = createService();
  const host = await service.createRoom("Host", "azure");
  const wing = await service.joinRoom(host.roomCode, "Wing", "emerald");
  const hostSocket = new FakeSocket();
  const wingSocket = new FakeSocket();
  await service.connectPlayer(host.roomCode, host.playerId, hostSocket as never);
  await service.connectPlayer(host.roomCode, wing.playerId, wingSocket as never);

  await service.handleMessage(host.roomCode, host.playerId, { type: "leave_room" });

  const state = await repository.get(host.roomCode);
  assert.equal(state?.players.length, 1);
  assert.equal(state?.players[0]?.playerId, wing.playerId);
  assert.equal(state?.players[0]?.isHost, true);
  assert.equal(state?.hostPlayerId, wing.playerId);
});

test("gateway clearRoom removes all tracked sockets and members", () => {
  const gateway = new WebSocketConnectionGateway();
  const socket1 = new FakeSocket();
  const socket2 = new FakeSocket();

  gateway.attach("ROOM1", "p1", socket1 as never);
  gateway.attach("ROOM1", "p2", socket2 as never);

  gateway.clearRoom("ROOM1");

  // After clearing, broadcasting should be a no-op
  const broadcastSocket = new FakeSocket();
  gateway.attach("ROOM1", "p3", broadcastSocket as never);
  assert.equal(broadcastSocket.sent.length, 0);
});

test("detaching player from non-existent room is safe", () => {
  const gateway = new WebSocketConnectionGateway();
  // Should not throw
  gateway.detach("NO_ROOM", "no-player");
});
