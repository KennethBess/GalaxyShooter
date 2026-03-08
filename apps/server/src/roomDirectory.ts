import { type RedisClientType } from "redis";
import { normalizeRoomCode } from "./runtime.js";

export interface RoomDirectory {
  setOwner(roomCode: string, ownerId: string): Promise<void>;
  tryClaimOwner(roomCode: string, ownerId: string): Promise<boolean>;
  renewOwner(roomCode: string, ownerId: string): Promise<boolean>;
  getOwner(roomCode: string): Promise<string | undefined>;
  remove(roomCode: string): Promise<void>;
}

export class InMemoryRoomDirectory implements RoomDirectory {
  private readonly owners = new Map<string, string>();

  async setOwner(roomCode: string, ownerId: string) {
    this.owners.set(normalizeRoomCode(roomCode), ownerId);
  }

  async tryClaimOwner(roomCode: string, ownerId: string) {
    const key = normalizeRoomCode(roomCode);
    if (this.owners.has(key) && this.owners.get(key) !== ownerId) {
      return false;
    }
    this.owners.set(key, ownerId);
    return true;
  }

  async renewOwner(roomCode: string, ownerId: string) {
    const key = normalizeRoomCode(roomCode);
    if (this.owners.get(key) !== ownerId) {
      return false;
    }
    this.owners.set(key, ownerId);
    return true;
  }

  async getOwner(roomCode: string) {
    return this.owners.get(normalizeRoomCode(roomCode));
  }

  async remove(roomCode: string) {
    this.owners.delete(normalizeRoomCode(roomCode));
  }
}

const roomOwnerKey = (roomCode: string) => `room:owner:${normalizeRoomCode(roomCode)}`;
const renewOwnerScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[2])
end
return false
`;

export class RedisRoomDirectory implements RoomDirectory {
  constructor(private readonly client: RedisClientType, private readonly ttlSeconds = 3600) {}

  async setOwner(roomCode: string, ownerId: string) {
    await this.client.set(roomOwnerKey(roomCode), ownerId, { EX: this.ttlSeconds });
  }

  async tryClaimOwner(roomCode: string, ownerId: string) {
    const result = await this.client.set(roomOwnerKey(roomCode), ownerId, {
      NX: true,
      EX: this.ttlSeconds
    });
    return result === "OK";
  }

  async renewOwner(roomCode: string, ownerId: string) {
    const result = await this.client.eval(renewOwnerScript, {
      keys: [roomOwnerKey(roomCode)],
      arguments: [ownerId, String(this.ttlSeconds)]
    });
    return result === "OK";
  }

  async getOwner(roomCode: string) {
    const owner = await this.client.get(roomOwnerKey(roomCode));
    return owner ?? undefined;
  }

  async remove(roomCode: string) {
    await this.client.del(roomOwnerKey(roomCode));
  }
}
