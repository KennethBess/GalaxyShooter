import { createRoomRuntime, defaultInputState, normalizeRoomCode, type RoomRuntime } from "./runtime.js";

export interface RoomRuntimeRegistry {
  create(roomCode: string, playerIds: Iterable<string>): RoomRuntime;
  get(roomCode: string): RoomRuntime | undefined;
  ensure(roomCode: string, playerIds: Iterable<string>): RoomRuntime;
  delete(roomCode: string): void;
  entries(): IterableIterator<[string, RoomRuntime]>;
}

export class InMemoryRoomRuntimeRegistry implements RoomRuntimeRegistry {
  private readonly runtimes = new Map<string, RoomRuntime>();

  create(roomCode: string, playerIds: Iterable<string>) {
    const runtime = createRoomRuntime(playerIds);
    this.runtimes.set(normalizeRoomCode(roomCode), runtime);
    return runtime;
  }

  get(roomCode: string) {
    return this.runtimes.get(normalizeRoomCode(roomCode));
  }

  ensure(roomCode: string, playerIds: Iterable<string>) {
    const normalized = normalizeRoomCode(roomCode);
    const existing = this.runtimes.get(normalized);
    if (existing) {
      for (const playerId of playerIds) {
        if (!existing.inputs.has(playerId)) {
          existing.inputs.set(playerId, defaultInputState());
        }
      }
      return existing;
    }
    return this.create(normalized, playerIds);
  }

  delete(roomCode: string) {
    this.runtimes.delete(normalizeRoomCode(roomCode));
  }

  entries() {
    return this.runtimes.entries();
  }
}
