import assert from "node:assert/strict";
import test from "node:test";
import { WebSocketConnectionGateway } from "../src/connectionGateway.js";
import { createMatch, updateMatch } from "../src/game.js";
import { InMemoryLeaderboardRepository } from "../src/leaderboardRepository.js";
import { InMemoryRoomDirectory } from "../src/roomDirectory.js";
import { InMemoryRoomMessageBus } from "../src/roomMessageBus.js";
import { InMemoryRoomRepository } from "../src/roomRepository.js";
import { RoomService } from "../src/roomService.js";
import { InMemoryRoomRuntimeRegistry } from "../src/runtimeRegistry.js";
import { createTestManager, FakeSocket, flushAsync, parseMessages } from "./helpers.js";

test("createRoom returns host room summary", async () => {
  const manager = createTestManager();
  const created = await manager.createRoom("Ace", "crimson");

  assert.equal(created.room.players.length, 1);
  assert.equal(created.room.players[0]?.name, "Ace");
  assert.equal(created.room.players[0]?.shipId, "crimson");
  assert.equal(created.room.hostPlayerId, created.playerId);
});

test("joinRoom rejects duplicates and full rooms", async () => {
  const manager = createTestManager();
  const created = await manager.createRoom("Host", "azure");
  await manager.joinRoom(created.roomCode, "Wing1", "emerald");
  await manager.joinRoom(created.roomCode, "Wing2", "crimson");
  await assert.rejects(() => manager.joinRoom(created.roomCode, "Wing2", "azure"), /already in use/);
  await manager.joinRoom(created.roomCode, "Wing3", "azure");

  await assert.rejects(() => manager.joinRoom(created.roomCode, "Wing4", "azure"), /Room is full/);
});

test("joinRoom accepts normalized room codes", async () => {
  const manager = createTestManager();
  const created = await manager.createRoom("Host", "azure");
  const joined = await manager.joinRoom(` ${created.roomCode.toLowerCase()} `, "Wing", "emerald");

  assert.equal(joined.roomCode, created.roomCode);
  assert.equal(joined.room.players[1]?.name, "Wing");
});

test("listOpenRooms only returns waiting rooms with space", async () => {
  const manager = createTestManager();
  const openRoom = await manager.createRoom("OpenHost", "azure");
  const fullRoom = await manager.createRoom("FullHost", "crimson");
  const startedRoom = await manager.createRoom("StartedHost", "emerald");

  await manager.joinRoom(fullRoom.roomCode, "Wing1", "azure");
  await manager.joinRoom(fullRoom.roomCode, "Wing2", "crimson");
  await manager.joinRoom(fullRoom.roomCode, "Wing3", "emerald");

  const startedWing = await manager.joinRoom(startedRoom.roomCode, "Wing", "azure");
  const hostSocket = new FakeSocket();
  const wingSocket = new FakeSocket();
  await manager.connectPlayer(startedRoom.roomCode, startedRoom.playerId, hostSocket as never);
  await manager.connectPlayer(startedRoom.roomCode, startedWing.playerId, wingSocket as never);
  await manager.handleMessage(startedRoom.roomCode, startedWing.playerId, { type: "ready", payload: { ready: true } });
  await manager.handleMessage(startedRoom.roomCode, startedRoom.playerId, { type: "start_match" });
  await manager.tick();

  const openRooms = await manager.listOpenRooms();

  assert.equal(openRooms.some((room) => room.roomCode === openRoom.roomCode), true);
  assert.equal(openRooms.some((room) => room.roomCode === fullRoom.roomCode), false);
  assert.equal(openRooms.some((room) => room.roomCode === startedRoom.roomCode), false);
  assert.equal(openRooms.find((room) => room.roomCode === openRoom.roomCode)?.hostName, "OpenHost");
});

test("host can start a room after players are ready", async () => {
  const manager = createTestManager();
  const host = await manager.createRoom("Host", "azure");
  const wing = await manager.joinRoom(host.roomCode, "Wing", "emerald");
  const hostSocket = new FakeSocket();
  const wingSocket = new FakeSocket();

  await manager.connectPlayer(host.roomCode, host.playerId, hostSocket as never);
  await manager.connectPlayer(host.roomCode, wing.playerId, wingSocket as never);
  await manager.handleMessage(host.roomCode, wing.playerId, { type: "ready", payload: { ready: true } });
  await manager.handleMessage(host.roomCode, host.playerId, { type: "start_match" });
  await manager.tick();

  assert.ok(hostSocket.sent.some((entry) => entry.includes("match_started")));
  assert.ok(hostSocket.sent.some((entry) => entry.includes("snapshot")));
  assert.ok(hostSocket.sent.some((entry) => entry.includes('"shipId":"emerald"')));
});

test("leave_room removes player from live match snapshots", async () => {
  const manager = createTestManager();
  const host = await manager.createRoom("Host", "azure");
  const wing = await manager.joinRoom(host.roomCode, "Wing", "emerald");
  const hostSocket = new FakeSocket();
  const wingSocket = new FakeSocket();

  await manager.connectPlayer(host.roomCode, host.playerId, hostSocket as never);
  await manager.connectPlayer(host.roomCode, wing.playerId, wingSocket as never);
  await manager.handleMessage(host.roomCode, wing.playerId, { type: "ready", payload: { ready: true } });
  await manager.handleMessage(host.roomCode, host.playerId, { type: "start_match" });
  await manager.tick();
  await manager.handleMessage(host.roomCode, wing.playerId, { type: "leave_room" });
  await manager.tick();

  const latestSnapshot = [...hostSocket.sent]
    .reverse()
    .map((entry) => JSON.parse(entry) as { type: string; payload?: { players?: Array<{ playerId: string }> } })
    .find((message) => message.type === "snapshot");

  assert.ok(latestSnapshot);
  assert.equal(latestSnapshot?.payload?.players?.some((player) => player.playerId === wing.playerId), false);
});

test("completed match returns room to waiting and supports another round", async () => {
  const repository = new InMemoryRoomRepository();
  const directory = new InMemoryRoomDirectory();
  const bus = new InMemoryRoomMessageBus();
  const runtimeRegistry = new InMemoryRoomRuntimeRegistry();
  const gateway = new WebSocketConnectionGateway();
  const service = new RoomService(repository, runtimeRegistry, gateway, directory, bus, "owner-a", 3600, new InMemoryLeaderboardRepository());
  const host = await service.createRoom("Host", "azure");
  const wing = await service.joinRoom(host.roomCode, "Wing", "emerald");
  const hostSocket = new FakeSocket();
  const wingSocket = new FakeSocket();

  await service.connectPlayer(host.roomCode, host.playerId, hostSocket as never);
  await service.connectPlayer(host.roomCode, wing.playerId, wingSocket as never);
  await service.handleMessage(host.roomCode, wing.playerId, { type: "ready", payload: { ready: true } });
  await service.handleMessage(host.roomCode, host.playerId, { type: "start_match" });
  await service.tick(50);

  const runtime = runtimeRegistry.get(host.roomCode);
  assert.ok(runtime?.match);
  runtime.match.result = {
    outcome: "victory",
    mode: "campaign",
    score: 1234,
    stageReached: 1,
    durationMs: 1500,
    players: [
      { playerId: host.playerId, name: "Host", shipId: "azure", score: 900 },
      { playerId: wing.playerId, name: "Wing", shipId: "emerald", score: 334 }
    ],
    leaderboardRank: null
  };

  await service.tick(50);

  const roomStates = parseMessages<{ type: string; payload?: { status?: string; players?: Array<{ playerId: string; ready: boolean; score: number }> } }>(hostSocket)
    .filter((message) => message.type === "room_state");
  const latestRoomState = roomStates.at(-1);
  assert.equal(latestRoomState?.payload?.status, "waiting");
  assert.equal(latestRoomState?.payload?.players?.find((player) => player.playerId === host.playerId)?.ready, true);
  assert.equal(latestRoomState?.payload?.players?.find((player) => player.playerId === wing.playerId)?.ready, false);
  assert.equal(latestRoomState?.payload?.players?.find((player) => player.playerId === host.playerId)?.score, 0);

  await service.handleMessage(host.roomCode, wing.playerId, { type: "ready", payload: { ready: true } });
  await service.handleMessage(host.roomCode, host.playerId, { type: "start_match" });
  await service.tick(50);

  const matchStartedCount = parseMessages<{ type: string }>(hostSocket).filter((message) => message.type === "match_started").length;
  assert.ok(matchStartedCount >= 2);
});

test("stale in_match room recovers on reconnect and can start again", async () => {
  const repository = new InMemoryRoomRepository();
  const directory = new InMemoryRoomDirectory();
  const bus = new InMemoryRoomMessageBus();
  const runtimeRegistry = new InMemoryRoomRuntimeRegistry();
  const gateway = new WebSocketConnectionGateway();
  const service = new RoomService(repository, runtimeRegistry, gateway, directory, bus, "owner-a", 3600, new InMemoryLeaderboardRepository());
  const host = await service.createRoom("Host", "azure");
  const hostSocket = new FakeSocket();

  await service.connectPlayer(host.roomCode, host.playerId, hostSocket as never);
  await service.handleMessage(host.roomCode, host.playerId, { type: "start_match" });
  await service.tick(50);

  const startedState = await repository.get(host.roomCode);
  assert.equal(startedState?.status, "in_match");

  runtimeRegistry.delete(host.roomCode);

  const reconnectSocket = new FakeSocket();
  const recoveredState = await service.connectPlayer(host.roomCode, host.playerId, reconnectSocket as never);
  assert.equal(recoveredState.status, "waiting");

  await service.handleMessage(host.roomCode, host.playerId, { type: "start_match" });
  await service.tick(50);

  const messages = parseMessages<{ type: string; payload?: { roomCode?: string } }>(reconnectSocket);
  assert.ok(messages.some((message) => message.type === "match_started"));
  assert.ok(messages.some((message) => message.type === "snapshot"));
});

test("multiple rooms can run matches at the same time", async () => {
  const manager = createTestManager();
  const roomA = await manager.createRoom("Alpha", "azure");
  const roomB = await manager.createRoom("Bravo", "crimson");
  const socketA = new FakeSocket();
  const socketB = new FakeSocket();

  await manager.connectPlayer(roomA.roomCode, roomA.playerId, socketA as never);
  await manager.connectPlayer(roomB.roomCode, roomB.playerId, socketB as never);
  await manager.handleMessage(roomA.roomCode, roomA.playerId, { type: "start_match" });
  await manager.handleMessage(roomB.roomCode, roomB.playerId, { type: "start_match" });
  await manager.tick(50);

  const messagesA = parseMessages<{ type: string; payload?: { roomCode?: string } }>(socketA);
  const messagesB = parseMessages<{ type: string; payload?: { roomCode?: string } }>(socketB);
  const snapshotA = messagesA.find((message) => message.type === "snapshot");
  const snapshotB = messagesB.find((message) => message.type === "snapshot");

  assert.equal(snapshotA?.payload?.roomCode, roomA.roomCode);
  assert.equal(snapshotB?.payload?.roomCode, roomB.roomCode);
  assert.equal(messagesA.some((message) => message.payload?.roomCode === roomB.roomCode), false);
  assert.equal(messagesB.some((message) => message.payload?.roomCode === roomA.roomCode), false);
});

test("non-owner instance routes ready command to owner and receives distributed room state", async () => {
  const repository = new InMemoryRoomRepository();
  const directory = new InMemoryRoomDirectory();
  const bus = new InMemoryRoomMessageBus();

  const ownerGateway = new WebSocketConnectionGateway();
  const remoteGateway = new WebSocketConnectionGateway();
  const ownerService = new RoomService(
    repository,
    new InMemoryRoomRuntimeRegistry(),
    ownerGateway,
    directory,
    bus,
    "owner-a",
    3600,
    new InMemoryLeaderboardRepository()
  );
  const remoteService = new RoomService(
    repository,
    new InMemoryRoomRuntimeRegistry(),
    remoteGateway,
    directory,
    bus,
    "owner-b",
    3600,
    new InMemoryLeaderboardRepository()
  );

  const host = await ownerService.createRoom("Host", "azure");
  const wing = await remoteService.joinRoom(host.roomCode, "Wing", "emerald");
  const hostSocket = new FakeSocket();
  const wingSocket = new FakeSocket();

  await ownerService.connectPlayer(host.roomCode, host.playerId, hostSocket as never);
  await remoteService.connectPlayer(host.roomCode, wing.playerId, wingSocket as never);
  await remoteService.handleMessage(host.roomCode, wing.playerId, { type: "ready", payload: { ready: true } });
  await flushAsync();

  const wingRoomStates = wingSocket.sent
    .map((entry) => JSON.parse(entry) as { type: string; payload?: { players?: Array<{ playerId: string; ready: boolean }> } })
    .filter((message) => message.type === "room_state");
  const latestRoomState = wingRoomStates.at(-1);
  const wingPlayer = latestRoomState?.payload?.players?.find((player) => player.playerId === wing.playerId);

  assert.ok(wingPlayer);
  assert.equal(wingPlayer?.ready, true);
});




test("stage transition clears prior stage entities and stage 2 continues", () => {
  const playerId = "player-1";
  const match = createMatch("ROOM1", "campaign", [{
    playerId,
    name: "Host",
    shipId: "azure",
    isHost: true,
    connected: true,
    ready: true,
    score: 0,
    livesLost: 0,
    joinedAt: Date.now()
  }]);

  match.stageIndex = 0;
  match.stageLabel = "Nebula Run";
  match.stageElapsedMs = 24000;
  match.stageBossSpawned = true;
  match.enemies = [
    {
      id: "boss-1",
      kind: "boss",
      x: 640,
      y: 140,
      vx: 0,
      vy: 0,
      hp: 1,
      maxHp: 420,
      radius: 56,
      fireCooldownMs: 1000,
      waveId: "stage-1-boss",
      boss: true,
      phase: 0,
      entered: true
    },
    {
      id: "enemy-1",
      kind: "heavy",
      x: 420,
      y: 180,
      vx: 0,
      vy: 0,
      hp: 28,
      maxHp: 28,
      radius: 28,
      fireCooldownMs: 1000,
      waveId: "stage-1-wave-6",
      boss: false,
      phase: 0,
      entered: true
    }
  ];
  match.bullets = [
    { id: "pb-1", owner: "player", ownerId: playerId, x: 640, y: 140, vx: 0, vy: 0, radius: 5, damage: 9 },
    { id: "eb-1", owner: "enemy", x: 300, y: 300, vx: 0, vy: 0, radius: 6, damage: 1 }
  ];
  match.pickups = [{ id: "pickup-1", kind: "weapon", x: 300, y: 300, vy: 0 }];

  const first = updateMatch(match, new Map(), 16);

  assert.equal(match.stageIndex, 1);
  assert.equal(match.stageLabel, "Carrier Graveyard");
  assert.equal(match.enemies.length, 0);
  assert.equal(match.bullets.length, 0);
  assert.equal(match.pickups.length, 0);
  assert.ok(first.events.some((event) => event.payload.kind === "stage_clear"));
  assert.equal(first.snapshot.stageIndex, 2);
  assert.equal(first.snapshot.stageLabel, "Carrier Graveyard");

  const second = updateMatch(match, new Map(), 1600);
  assert.ok(second.snapshot.enemies.length > 0);
  assert.equal(second.snapshot.stageIndex, 2);
  assert.equal(second.snapshot.stageLabel, "Carrier Graveyard");
});

test("player movement and snapshots continue through stage transition", () => {
  const playerId = "player-1";
  const match = createMatch("ROOM2", "campaign", [{
    playerId,
    name: "Host",
    shipId: "azure",
    isHost: true,
    connected: true,
    ready: true,
    score: 0,
    livesLost: 0,
    joinedAt: Date.now()
  }]);

  match.stageIndex = 0;
  match.stageLabel = "Nebula Run";
  match.stageElapsedMs = 24000;
  match.stageBossSpawned = true;
  match.enemies = [{
    id: "boss-1",
    kind: "boss",
    x: 640,
    y: 140,
    vx: 0,
    vy: 0,
    hp: 1,
    maxHp: 420,
    radius: 56,
    fireCooldownMs: 1000,
    waveId: "stage-1-boss",
    boss: true,
    phase: 0,
    entered: true
  }];
  match.bullets = [
    { id: "pb-1", owner: "player", ownerId: playerId, x: 640, y: 140, vx: 0, vy: 0, radius: 5, damage: 9 }
  ];

  const initialX = match.players.get(playerId)!.x;
  const inputs = new Map([[playerId, { up: false, down: false, left: false, right: true, shoot: false }]]);

  const first = updateMatch(match, inputs, 16);
  const second = updateMatch(match, inputs, 200);
  const third = updateMatch(match, inputs, 1600);

  assert.equal(first.snapshot.stageIndex, 2);
  assert.equal(second.snapshot.stageIndex, 2);
  assert.equal(third.snapshot.stageIndex, 2);
  assert.ok(second.snapshot.players[0]!.x > initialX);
  assert.ok(third.snapshot.players[0]!.x > second.snapshot.players[0]!.x);
  assert.ok(third.snapshot.enemies.length > 0);
});

