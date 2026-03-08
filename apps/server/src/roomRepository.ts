import { customAlphabet } from "nanoid";
import { type RedisClientType } from "redis";
import { ROOM_CODE_LENGTH, type RoomState } from "../../../packages/shared/src/index.js";
import { normalizeRoomCode } from "./runtime.js";

export interface RoomRepository {
  allocateRoomCode(): Promise<string>;
  get(roomCode: string): Promise<RoomState | undefined>;
  list(): Promise<RoomState[]>;
  save(room: RoomState): Promise<void>;
  delete(roomCode: string): Promise<void>;
}

const makeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", ROOM_CODE_LENGTH);

export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, RoomState>();

  async allocateRoomCode() {
    const maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
      const roomCode = makeCode();
      if (!this.rooms.has(roomCode)) {
        return roomCode;
      }
    }
    throw new Error("Unable to allocate a unique room code");
  }

  async get(roomCode: string) {
    return this.rooms.get(normalizeRoomCode(roomCode));
  }

  async list() {
    return [...this.rooms.values()];
  }

  async save(room: RoomState) {
    this.rooms.set(normalizeRoomCode(room.roomCode), room);
  }

  async delete(roomCode: string) {
    this.rooms.delete(normalizeRoomCode(roomCode));
  }
}

const roomStateKey = (roomCode: string) => `room:state:${normalizeRoomCode(roomCode)}`;
const roomReservationKey = (roomCode: string) => `room:reserve:${normalizeRoomCode(roomCode)}`;
const roomIndexKey = "room:index";

export class RedisRoomRepository implements RoomRepository {
  constructor(
    private readonly client: RedisClientType,
    private readonly ttlSeconds = 3600,
    private readonly reservationTtlSeconds = 30
  ) {}

  async allocateRoomCode() {
    const maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
      const roomCode = makeCode();
      const reserved = await this.client.set(roomReservationKey(roomCode), "1", {
        NX: true,
        EX: this.reservationTtlSeconds
      });
      if (reserved === "OK") {
        return roomCode;
      }
    }
    throw new Error("Unable to allocate a unique room code");
  }

  async get(roomCode: string) {
    const raw = await this.client.get(roomStateKey(roomCode));
    return raw ? (JSON.parse(raw) as RoomState) : undefined;
  }

  async list() {
    const roomCodes = await this.client.sMembers(roomIndexKey);
    if (roomCodes.length === 0) {
      return [];
    }

    const rawRooms = await this.client.mGet(roomCodes.map((roomCode) => roomStateKey(roomCode)));
    const liveRooms: RoomState[] = [];
    const staleCodes: string[] = [];

    rawRooms.forEach((raw, index) => {
      if (!raw) {
        staleCodes.push(roomCodes[index]!);
        return;
      }
      liveRooms.push(JSON.parse(raw) as RoomState);
    });

    if (staleCodes.length > 0) {
      await this.client.sRem(roomIndexKey, staleCodes);
    }

    return liveRooms;
  }

  async save(room: RoomState) {
    const code = normalizeRoomCode(room.roomCode);
    await this.client.multi()
      .set(roomStateKey(code), JSON.stringify(room), { EX: this.ttlSeconds })
      .del(roomReservationKey(code))
      .sAdd(roomIndexKey, code)
      .expire(roomIndexKey, this.ttlSeconds)
      .exec();
  }

  async delete(roomCode: string) {
    const code = normalizeRoomCode(roomCode);
    await this.client.multi()
      .del(roomStateKey(code))
      .del(roomReservationKey(code))
      .sRem(roomIndexKey, code)
      .exec();
  }
}
