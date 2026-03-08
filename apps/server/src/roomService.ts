import type WebSocket from "ws";
import { DEFAULT_SHIP_ID, MAX_PLAYERS, RECONNECT_GRACE_MS, isShipId } from "../../../packages/shared/src/index.js";
import type { ClientMessage, OpenRoomSummary, PlayerSlot, RoomState, RoomSummary, ServerMessage, ShipId } from "../../../packages/shared/src/index.js";
import type { ConnectionGateway } from "./connectionGateway.js";
import type { RoomDirectory } from "./roomDirectory.js";
import { logInfo } from "./logger.js";
import { MatchService } from "./matchService.js";
import type { RoomCommandEnvelope, RoomEventEnvelope, RoomMessageBus } from "./roomMessageBus.js";
import type { RoomRepository } from "./roomRepository.js";
import { defaultInputState, normalizeRoomCode, type RoomRuntime } from "./runtime.js";
import type { RoomRuntimeRegistry } from "./runtimeRegistry.js";

export class RoomService {
  private readonly ownedRooms = new Set<string>();
  private lastLeaseRenewalMs = 0;

  constructor(
    private readonly repository: RoomRepository,
    private readonly runtimes: RoomRuntimeRegistry,
    private readonly connections: ConnectionGateway,
    private readonly directory: RoomDirectory,
    private readonly bus: RoomMessageBus,
    private readonly instanceId: string,
    private readonly ownershipTtlSeconds: number,
    private readonly matches = new MatchService()
  ) {
    this.bus.onCommand((command) => {
      void this.handleDistributedCommand(command);
    });
    this.bus.onEvent((event) => {
      void this.handleDistributedEvent(event);
    });
  }

  async createRoom(playerName: string, shipId: string = DEFAULT_SHIP_ID): Promise<RoomSummary> {
    const name = this.validateName(playerName);
    const validatedShipId = this.validateShipId(shipId);
    const roomCode = await this.repository.allocateRoomCode();
    const now = Date.now();
    const host: PlayerSlot = {
      playerId: crypto.randomUUID(),
      name,
      shipId: validatedShipId,
      isHost: true,
      connected: false,
      ready: true,
      score: 0,
      livesLost: 0,
      joinedAt: now
    };

    const state: RoomState = {
      roomCode,
      status: "waiting",
      mode: "campaign",
      maxPlayers: MAX_PLAYERS,
      hostPlayerId: host.playerId,
      players: [host],
      teamLives: 0,
      createdAt: now,
      updatedAt: now
    };

    await this.repository.save(state);
    await this.directory.setOwner(roomCode, this.instanceId);
    this.ownedRooms.add(normalizeRoomCode(roomCode));
    this.runtimes.create(roomCode, [host.playerId]);
    return { roomCode: state.roomCode, playerId: host.playerId, room: state };
  }

  async joinRoom(roomCode: string, playerName: string, shipId: string = DEFAULT_SHIP_ID): Promise<RoomSummary> {
    const state = await this.getState(roomCode);
    if (state.status !== "waiting") {
      throw new Error("Match already started");
    }
    if (state.players.length >= state.maxPlayers) {
      throw new Error("Room is full");
    }

    const name = this.validateName(playerName);
    const validatedShipId = this.validateShipId(shipId);
    if (state.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Player name is already in use in this room");
    }

    const player: PlayerSlot = {
      playerId: crypto.randomUUID(),
      name,
      shipId: validatedShipId,
      isHost: false,
      connected: false,
      ready: false,
      score: 0,
      livesLost: 0,
      joinedAt: Date.now()
    };

    state.players.push(player);
    state.updatedAt = Date.now();
    await this.repository.save(state);

    const runtime = this.getOrCreateRuntime(state);
    runtime.inputs.set(player.playerId, defaultInputState());

    await this.emitDistributed(state.roomCode, [{ type: "room_state", payload: state }]);
    return { roomCode: state.roomCode, playerId: player.playerId, room: state };
  }

  async validatePlayer(roomCode: string, playerId: string): Promise<RoomState> {
    const state = await this.getState(roomCode);
    if (!state.players.some((player) => player.playerId === playerId)) {
      throw new Error("Player not found in room");
    }
    return state;
  }

  async listOpenRooms(): Promise<OpenRoomSummary[]> {
    const rooms = await this.repository.list();
    return rooms
      .filter((room) => room.status === "waiting" && room.players.length < room.maxPlayers)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((room) => ({
        roomCode: room.roomCode,
        mode: room.mode,
        status: room.status,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        hostName: room.players.find((player) => player.isHost)?.name ?? room.players[0]?.name ?? "Host",
        createdAt: room.createdAt,
        updatedAt: room.updatedAt
      }));
  }

  async connectPlayer(roomCode: string, playerId: string, socket?: WebSocket): Promise<RoomState> {
    const state = await this.validatePlayer(roomCode, playerId);
    const runtime = this.getOrCreateRuntime(state);
    if (await this.resetStaleMatchIfNeeded(state, runtime)) {
      logInfo("Recovered stale room state on connect", { roomCode: state.roomCode, playerId });
    }
    const player = state.players.find((candidate) => candidate.playerId === playerId);
    if (!player) {
      throw new Error("Player not found in room");
    }

    const timeout = runtime.disconnectTimers.get(playerId);
    if (timeout) {
      clearTimeout(timeout);
      runtime.disconnectTimers.delete(playerId);
    }

    this.connections.attach(state.roomCode, playerId, socket);
    player.connected = true;
    state.updatedAt = Date.now();
    await this.repository.save(state);
    await this.emitDistributed(state.roomCode, [{ type: "room_state", payload: state }]);
    return state;
  }

  async disconnectPlayer(roomCode: string, playerId: string): Promise<void> {
    const state = await this.repository.get(roomCode);
    const runtime = this.runtimes.get(roomCode);
    if (!state || !runtime) {
      return;
    }
    const player = state.players.find((candidate) => candidate.playerId === playerId);
    if (!player) {
      return;
    }

    this.connections.detach(state.roomCode, playerId);
    player.connected = false;
    state.updatedAt = Date.now();
    await this.repository.save(state);
    await this.emitDistributed(state.roomCode, [{ type: "room_state", payload: state }]);

    const timeout = setTimeout(() => {
      void (async () => {
        const latestState = await this.repository.get(state.roomCode);
        const latestRuntime = this.runtimes.get(state.roomCode);
        if (!latestState || !latestRuntime) {
          return;
        }
        latestRuntime.disconnectTimers.delete(playerId);
        await this.removePlayer(latestState.roomCode, playerId);
      })();
    }, RECONNECT_GRACE_MS);

    runtime.disconnectTimers.set(playerId, timeout);
  }

  async handleMessage(roomCode: string, playerId: string, message: ClientMessage): Promise<void> {
    const state = await this.getState(roomCode);
    const owner = await this.ensureOwner(state.roomCode);
    if (owner !== this.instanceId) {
      logInfo("Forwarding room command to owner", {
        roomCode: state.roomCode,
        playerId,
        owner,
        messageType: message.type
      });
      await this.bus.publishCommand({ roomCode: state.roomCode, playerId, message });
      return;
    }

    await this.processOwnerMessage(state, this.getOrCreateRuntime(state), playerId, message);
  }

  async tick(deltaMs: number): Promise<void> {
    await this.renewOwnedRoomLeases();

    for (const [roomCode, runtime] of this.runtimes.entries()) {
      if (!this.ownedRooms.has(roomCode)) {
        continue;
      }
      const state = await this.repository.get(roomCode);
      if (!state) {
        this.runtimes.delete(roomCode);
        this.ownedRooms.delete(roomCode);
        continue;
      }
      if (await this.resetStaleMatchIfNeeded(state, runtime)) {
        await this.emitDistributed(state.roomCode, [{ type: "room_state", payload: state }]);
        continue;
      }
      const messages = this.matches.tick(state, runtime, deltaMs);
      if (messages.length > 0) {
        await this.repository.save(state);
        await this.emitDistributed(state.roomCode, messages);
      }
    }
  }

  private async handleDistributedCommand(command: RoomCommandEnvelope): Promise<void> {
    const normalizedRoomCode = normalizeRoomCode(command.roomCode);
    if (!this.ownedRooms.has(normalizedRoomCode)) {
      return;
    }
    const owner = await this.directory.getOwner(command.roomCode);
    if (owner !== this.instanceId) {
      return;
    }
    const state = await this.repository.get(command.roomCode);
    if (!state) {
      return;
    }

    logInfo("Received distributed room command", {
      roomCode: state.roomCode,
      playerId: command.playerId,
      messageType: command.message.type
    });
    await this.processOwnerMessage(state, this.getOrCreateRuntime(state), command.playerId, command.message);
  }

  private async handleDistributedEvent(event: RoomEventEnvelope): Promise<void> {
    if (event.originInstanceId === this.instanceId) {
      return;
    }
    logInfo("Applying distributed room event", {
      roomCode: event.roomCode,
      originInstanceId: event.originInstanceId,
      messageTypes: event.messages.map((message) => message.type).join(",")
    });
    for (const message of event.messages) {
      await this.connections.broadcastToRoom(event.roomCode, message);
    }
  }

  private async processOwnerMessage(state: RoomState, runtime: RoomRuntime, playerId: string, message: ClientMessage): Promise<void> {
    if (await this.resetStaleMatchIfNeeded(state, runtime)) {
      await this.emitDistributed(state.roomCode, [{ type: "room_state", payload: state }]);
    }

    const player = state.players.find((candidate) => candidate.playerId === playerId);
    if (!player) {
      throw new Error("Player not found in room");
    }

    logInfo("Processing owner room command", {
      roomCode: state.roomCode,
      playerId,
      messageType: message.type,
      status: state.status,
      instanceId: this.instanceId
    });

    switch (message.type) {
      case "ready": {
        if (state.status !== "waiting") {
          return;
        }
        player.ready = message.payload.ready;
        state.updatedAt = Date.now();
        await this.repository.save(state);
        await this.emitDistributed(state.roomCode, [{ type: "room_state", payload: state }]);
        return;
      }
      case "set_mode": {
        if (!player.isHost || state.status !== "waiting") {
          return;
        }
        state.mode = message.payload.mode;
        state.updatedAt = Date.now();
        await this.repository.save(state);
        await this.emitDistributed(state.roomCode, [{ type: "room_state", payload: state }]);
        return;
      }
      case "start_match": {
        if (!player.isHost) {
          return;
        }
        logInfo("Starting room match", {
          roomCode: state.roomCode,
          hostPlayerId: playerId,
          mode: state.mode,
          playerCount: state.players.length,
          connectedPlayers: state.players.filter((candidate) => candidate.connected).length
        });
        const messages = this.matches.start(state, runtime);
        await this.repository.save(state);
        await this.emitDistributed(state.roomCode, messages);
        logInfo("Room match started", {
          roomCode: state.roomCode,
          messageTypes: messages.map((candidate) => candidate.type).join(",")
        });
        return;
      }
      case "input": {
        runtime.inputs.set(playerId, message.payload);
        return;
      }
      case "use_bomb": {
        this.matches.queueBomb(runtime, playerId);
        return;
      }
      case "leave_room": {
        await this.removePlayer(state.roomCode, playerId);
        return;
      }
      case "reconnect": {
        return;
      }
    }
  }

  private async removePlayer(roomCode: string, playerId: string): Promise<void> {
    const state = await this.repository.get(roomCode);
    const runtime = this.runtimes.get(roomCode);
    if (!state || !runtime) {
      return;
    }

    this.connections.detach(state.roomCode, playerId);
    runtime.inputs.delete(playerId);
    this.matches.removePlayer(runtime, playerId);

    const timeout = runtime.disconnectTimers.get(playerId);
    if (timeout) {
      clearTimeout(timeout);
      runtime.disconnectTimers.delete(playerId);
    }

    state.players = state.players.filter((player) => player.playerId !== playerId);
    if (state.players.length === 0) {
      this.connections.clearRoom(state.roomCode);
      this.runtimes.delete(state.roomCode);
      this.ownedRooms.delete(normalizeRoomCode(state.roomCode));
      await this.directory.remove(state.roomCode);
      await this.repository.delete(state.roomCode);
      return;
    }

    if (!state.players.some((candidate) => candidate.isHost)) {
      state.players[0]!.isHost = true;
    }
    state.hostPlayerId = state.players.find((candidate) => candidate.isHost)?.playerId ?? state.players[0]!.playerId;
    state.updatedAt = Date.now();
    await this.repository.save(state);
    await this.emitDistributed(state.roomCode, [
      { type: "player_left", payload: { playerId } },
      { type: "room_state", payload: state }
    ]);
  }

  private async ensureOwner(roomCode: string) {
    const normalized = normalizeRoomCode(roomCode);
    const currentOwner = await this.directory.getOwner(normalized);
    if (currentOwner) {
      if (currentOwner === this.instanceId) {
        this.ownedRooms.add(normalized);
      }
      return currentOwner;
    }

    const claimed = await this.directory.tryClaimOwner(normalized, this.instanceId);
    if (claimed) {
      this.ownedRooms.add(normalized);
      return this.instanceId;
    }

    return (await this.directory.getOwner(normalized)) ?? this.instanceId;
  }

  private async renewOwnedRoomLeases() {
    const now = Date.now();
    if (now - this.lastLeaseRenewalMs < Math.max(5000, Math.floor((this.ownershipTtlSeconds * 1000) / 2))) {
      return;
    }
    this.lastLeaseRenewalMs = now;

    for (const roomCode of [...this.ownedRooms]) {
      const renewed = await this.directory.renewOwner(roomCode, this.instanceId);
      if (!renewed) {
        this.ownedRooms.delete(roomCode);
      }
    }
  }

  private async emitDistributed(roomCode: string, messages: readonly ServerMessage[]) {
    if (messages.length === 0) {
      return;
    }

    logInfo("Broadcasting room messages", {
      roomCode,
      messageTypes: messages.map((message) => message.type).join(","),
      count: messages.length
    });
    for (const message of messages) {
      await this.connections.broadcastToRoom(roomCode, message);
    }
    await this.bus.publishEvents({
      roomCode,
      originInstanceId: this.instanceId,
      messages: [...messages]
    });
  }

  private async getState(roomCode: string): Promise<RoomState> {
    const state = await this.repository.get(normalizeRoomCode(roomCode));
    if (!state) {
      throw new Error("Room not found");
    }
    return state;
  }

  private getOrCreateRuntime(state: RoomState): RoomRuntime {
    return this.runtimes.ensure(
      state.roomCode,
      state.players.map((player) => player.playerId)
    );
  }

  private async resetStaleMatchIfNeeded(state: RoomState, runtime: RoomRuntime) {
    if (state.status !== "in_match" || runtime.match) {
      return false;
    }

    state.status = "waiting";
    state.teamLives = 0;
    for (const player of state.players) {
      player.ready = player.isHost;
      player.score = 0;
      player.livesLost = 0;
    }
    for (const playerId of runtime.inputs.keys()) {
      runtime.inputs.set(playerId, defaultInputState());
    }
    state.updatedAt = Date.now();
    await this.repository.save(state);
    return true;
  }

  private validateName(playerName: string) {
    const trimmed = playerName.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      throw new Error("Player name must be 2-16 characters");
    }
    return trimmed;
  }

  private validateShipId(shipId: string): ShipId {
    if (!isShipId(shipId)) {
      throw new Error("Invalid ship selection");
    }
    return shipId;
  }
}
