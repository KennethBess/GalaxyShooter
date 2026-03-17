import type { PlayerRecord } from "@shared/index";
import { nanoid } from "nanoid";
import type { RedisClientType } from "redis";

export interface PlayerRepository {
  register(fullName: string, email: string, phone?: string): Promise<{ id: string; existing: boolean }>;
  getById(id: string): Promise<PlayerRecord | null>;
  getByEmail(email: string): Promise<PlayerRecord | null>;
  getAll(): Promise<PlayerRecord[]>;
}

const playerKey = (id: string) => `player:${id}`;
const emailIndexKey = (email: string) => `players:email:${email.toLowerCase()}`;
const ALL_PLAYERS_SET = "players:all";

export class InMemoryPlayerRepository implements PlayerRepository {
  private readonly players = new Map<string, PlayerRecord>();
  private readonly emailIndex = new Map<string, string>();

  async register(fullName: string, email: string, phone?: string): Promise<{ id: string; existing: boolean }> {
    const normalizedEmail = email.toLowerCase();
    const existingId = this.emailIndex.get(normalizedEmail);
    if (existingId) {
      return { id: existingId, existing: true };
    }

    const id = nanoid();
    const record: PlayerRecord = {
      id,
      fullName,
      email: normalizedEmail,
      phone: phone ?? null,
      registeredAt: new Date().toISOString(),
    };
    this.players.set(id, record);
    this.emailIndex.set(normalizedEmail, id);
    return { id, existing: false };
  }

  async getById(id: string): Promise<PlayerRecord | null> {
    return this.players.get(id) ?? null;
  }

  async getByEmail(email: string): Promise<PlayerRecord | null> {
    const id = this.emailIndex.get(email.toLowerCase());
    if (!id) return null;
    return this.players.get(id) ?? null;
  }

  async getAll(): Promise<PlayerRecord[]> {
    return Array.from(this.players.values());
  }
}

export class RedisPlayerRepository implements PlayerRepository {
  constructor(private readonly client: RedisClientType) {}

  async register(fullName: string, email: string, phone?: string): Promise<{ id: string; existing: boolean }> {
    const normalizedEmail = email.toLowerCase();
    const existingId = await this.client.get(emailIndexKey(normalizedEmail));
    if (existingId) {
      return { id: existingId, existing: true };
    }

    const id = nanoid();
    const registeredAt = new Date().toISOString();

    await this.client.multi()
      .hSet(playerKey(id), {
        fullName,
        email: normalizedEmail,
        phone: phone ?? "",
        registeredAt,
      })
      .set(emailIndexKey(normalizedEmail), id)
      .sAdd(ALL_PLAYERS_SET, id)
      .exec();

    return { id, existing: false };
  }

  async getById(id: string): Promise<PlayerRecord | null> {
    const data = await this.client.hGetAll(playerKey(id));
    if (!data.fullName) return null;
    return {
      id,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone || null,
      registeredAt: data.registeredAt,
    };
  }

  async getByEmail(email: string): Promise<PlayerRecord | null> {
    const id = await this.client.get(emailIndexKey(email.toLowerCase()));
    if (!id) return null;
    return this.getById(id);
  }

  async getAll(): Promise<PlayerRecord[]> {
    const ids = await this.client.sMembers(ALL_PLAYERS_SET);
    const records: PlayerRecord[] = [];
    for (const id of ids) {
      const record = await this.getById(id);
      if (record) records.push(record);
    }
    return records;
  }
}
