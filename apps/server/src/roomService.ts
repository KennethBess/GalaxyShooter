import type { ClientMessage, OpenRoomSummary, PlayerSlot, RoomState, RoomSummary, ServerMessage, ShipId } from "@shared/index";
import { DEFAULT_SHIP_ID, isShipId, MAX_PLAYERS, RECONNECT_GRACE_MS } from "@shared/index";
import type WebSocket from "ws";
import type { ConnectionGateway } from "./connectionGateway.js";
import type { LeaderboardRepository } from "./leaderboardRepository.js";
import { logError, logInfo } from "./logger.js";
import { MatchService } from "./matchService.js";
import type { RoomDirectory } from "./roomDirectory.js";
import type { RoomCommandEnvelope, RoomEventEnvelope, RoomMessageBus } from "./roomMessageBus.js";
import type { RoomRepository } from "./roomRepository.js";
import { defaultInputState, normalizeRoomCode, type RoomRuntime } from "./runtime.js";
import type { RoomRuntimeRegistry } from "./runtimeRegistry.js";

/** Cache entry for ownership lookups to avoid hitting Redis on every input message. */
interface OwnerCacheEntry {
  owner: string;
  cachedAt: number;
}

/** How long (ms) an ownership lookup result is considered fresh before re-checking Redis. */
const OWNER_CACHE_TTL_MS = 5_000;

export class RoomService {
  private readonly ownedRooms = new Set<string>();
  private lastLeaseRenewalMs = 0;
  private readonly stateCache = new Map<string, RoomState>();
  private readonly saveInFlight = new Set<string>();
  private readonly pendingSave = new Map<string, RoomState>();
  private readonly ownerCache = new Map<string, OwnerCacheEntry>();
  /** Maps controller connection ID to { roomCode, playerId } for input routing. */
  private readonly controllerBindings = new Map<string, { roomCode: string; playerId: string }>();

  constructor(
    private readonly repository: RoomRepository,
    private readonly runtimes: RoomRuntimeRegistry,
    private readonly connections: ConnectionGateway,
    private readonly directory: RoomDirectory,
    private readonly bus: RoomMessageBus,
    private readonly instanceId: string,
    private readonly ownershipTtlSeconds: number,
    leaderboard: LeaderboardRepository,
    private readonly matches = new MatchService(leaderboard)
  ) {
    this.bus.onCommand((command) => {
      void this.handleDistributedCommand(command);
    });
    this.bus.onEvent((event) => {
      void this.handleDistributedEvent(event);
    });
  }

  async createRoom(playerName: string, shipId: string = DEFAULT_SHIP_ID, email = ""): Promise<RoomSummary> {
    const name = this.validateName(playerName);
    const validatedShipId = this.validateShipId(shipId);
    const roomCode = await this.repository.allocateRoomCode();
    const now = Date.now();
    const host: PlayerSlot = {
      playerId: crypto.randomUUID(),
      name,
      email,
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
    this.stateCache.set(normalizeRoomCode(state.roomCode), state);
    await this.directory.setOwner(roomCode, this.instanceId);
    this.ownedRooms.add(normalizeRoomCode(roomCode));
    this.runtimes.create(roomCode, [host.playerId]);
    return { roomCode: state.roomCode, playerId: host.playerId, room: state };
  }

  async joinRoom(roomCode: string, playerName: string, shipId: string = DEFAULT_SHIP_ID, email = ""): Promise<RoomSummary> {
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
      email,
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
    if (this.resetStaleMatchIfNeeded(state, runtime)) {
      logInfo("Recovered stale room state on connect", { roomCode: state.roomCode, playerId });
      await this.repository.save(state);
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
    const code = normalizeRoomCode(roomCode);
    const state = this.stateCache.get(code) ?? await this.repository.get(roomCode);
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
        const latestCode = normalizeRoomCode(state.roomCode);
        const latestState = this.stateCache.get(latestCode) ?? await this.repository.get(state.roomCode);
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

  async connectController(roomCode: string, targetPlayerId: string, controllerId: string): Promise<string> {
    const state = await this.validatePlayer(roomCode, targetPlayerId);
    const player = state.players.find((p) => p.playerId === targetPlayerId);
    if (!player) {
      throw new Error("Player not found in room");
    }
    this.controllerBindings.set(controllerId, { roomCode: normalizeRoomCode(roomCode), playerId: targetPlayerId });
    logInfo("Controller paired", { roomCode, targetPlayerId, controllerId });
    return player.name;
  }

  disconnectController(controllerId: string): void {
    const binding = this.controllerBindings.get(controllerId);
    if (binding) {
      logInfo("Controller disconnected", { controllerId, playerId: binding.playerId, roomCode: binding.roomCode });
      this.controllerBindings.delete(controllerId);
    }
  }

  async handleControllerMessage(controllerId: string, message: ClientMessage): Promise<void> {
    const binding = this.controllerBindings.get(controllerId);
    if (!binding) {
      throw new Error("Controller not paired");
    }
    if (message.type === "input") {
      const runtime = this.runtimes.get(binding.roomCode);
      if (runtime) {
        runtime.inputs.set(binding.playerId, message.payload);
      }
      return;
    }
    if (message.type === "use_bomb") {
      const runtime = this.runtimes.get(binding.roomCode);
      if (runtime) {
        this.matches.queueBomb(runtime, binding.playerId);
      }
      return;
    }
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
      try {
        const state = this.stateCache.get(roomCode) ?? await this.repository.get(roomCode);
        if (!state) {
          this.runtimes.delete(roomCode);
          this.ownedRooms.delete(roomCode);
          continue;
        }
        this.stateCache.set(roomCode, state);
        if (this.resetStaleMatchIfNeeded(state, runtime)) {
          this.scheduleSave(state);
          void this.emitDistributed(state.roomCode, [{ type: "room_state", payload: state }]).catch(
            (error) => logError("Broadcast failed for room", error, { roomCode })
          );
          continue;
        }
        const messages = await this.matches.tick(state, runtime, deltaMs);
        if (messages.length > 0) {
          this.scheduleSave(state);
          void this.emitDistributed(state.roomCode, messages).catch(
            (error) => logError("Broadcast failed for room", error, { roomCode })
          );
        }
      } catch (error) {
        logError("Tick failed for room", error, { roomCode });
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
    const state = this.stateCache.get(normalizedRoomCode) ?? await this.repository.get(command.roomCode);
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
    if (this.resetStaleMatchIfNeeded(state, runtime)) {
      await this.repository.save(state);
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
      case "ping": {
        return;
      }
      case "controller_connect": {
        // Controller pairing is handled at the transport layer (index.ts), not here.
        return;
      }
    }
  }

  private async removePlayer(roomCode: string, playerId: string): Promise<void> {
    const code = normalizeRoomCode(roomCode);
    const state = this.stateCache.get(code) ?? await this.repository.get(roomCode);
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
      const normalized = normalizeRoomCode(state.roomCode);
      this.ownedRooms.delete(normalized);
      this.stateCache.delete(normalized);
      this.pendingSave.delete(normalized);
      this.ownerCache.delete(normalized);
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

    // Return cached owner if still fresh, avoiding a Redis round-trip on every input message.
    const cached = this.ownerCache.get(normalized);
    if (cached && Date.now() - cached.cachedAt < OWNER_CACHE_TTL_MS) {
      if (cached.owner === this.instanceId) {
        this.ownedRooms.add(normalized);
      }
      return cached.owner;
    }

    const currentOwner = await this.directory.getOwner(normalized);
    if (currentOwner) {
      this.ownerCache.set(normalized, { owner: currentOwner, cachedAt: Date.now() });
      if (currentOwner === this.instanceId) {
        this.ownedRooms.add(normalized);
      }
      return currentOwner;
    }

    // Try to claim ownership; always re-read after attempt to handle races
    const claimed = await this.directory.tryClaimOwner(normalized, this.instanceId);
    if (claimed) {
      this.ownedRooms.add(normalized);
      this.ownerCache.set(normalized, { owner: this.instanceId, cachedAt: Date.now() });
      return this.instanceId;
    }

    const winner = await this.directory.getOwner(normalized);
    if (!winner) {
      // Another instance claimed and released between our calls — safe to self-assign
      const retryClaimed = await this.directory.tryClaimOwner(normalized, this.instanceId);
      if (retryClaimed) {
        this.ownedRooms.add(normalized);
        this.ownerCache.set(normalized, { owner: this.instanceId, cachedAt: Date.now() });
      }
      return this.instanceId;
    }
    this.ownerCache.set(normalized, { owner: winner, cachedAt: Date.now() });
    return winner;
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

    await Promise.all(messages.map((message) => this.connections.broadcastToRoom(roomCode, message)));
    await this.bus.publishEvents({
      roomCode,
      originInstanceId: this.instanceId,
      messages: [...messages]
    });
  }

  /** Fire-and-forget persist with latest-wins: only the most recent state is written to Redis. */
  private scheduleSave(state: RoomState) {
    const code = normalizeRoomCode(state.roomCode);
    this.stateCache.set(code, state);
    this.pendingSave.set(code, state);
    if (this.saveInFlight.has(code)) {
      return;
    }
    void this.drainSave(code);
  }

  private async drainSave(code: string) {
    this.saveInFlight.add(code);
    try {
      while (this.pendingSave.has(code)) {
        const state = this.pendingSave.get(code)!;
        this.pendingSave.delete(code);
        try {
          await this.repository.save(state);
        } catch (error) {
          logError("Persist failed for room", error, { roomCode: code });
        }
      }
    } finally {
      this.saveInFlight.delete(code);
    }
  }

  private async getState(roomCode: string): Promise<RoomState> {
    const code = normalizeRoomCode(roomCode);
    const cached = this.stateCache.get(code);
    if (cached) return cached;
    const state = await this.repository.get(code);
    if (!state) {
      throw new Error("Room not found");
    }
    this.stateCache.set(code, state);
    return state;
  }

  private getOrCreateRuntime(state: RoomState): RoomRuntime {
    return this.runtimes.ensure(
      state.roomCode,
      state.players.map((player) => player.playerId)
    );
  }

  private resetStaleMatchIfNeeded(state: RoomState, runtime: RoomRuntime): boolean {
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
    return true;
  }

  private validateName(playerName: string) {
    const trimmed = playerName.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      throw new Error("Player name must be 2-16 characters");
    }
    return trimmed
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private validateShipId(shipId: string): ShipId {
    if (!isShipId(shipId)) {
      throw new Error("Invalid ship selection");
    }
    return shipId;
  }
}
