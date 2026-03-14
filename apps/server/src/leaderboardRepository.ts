import type { GameMode, LeaderboardEntry } from "@shared/index";
import { nanoid } from "nanoid";
import type { RedisClientType } from "redis";

export interface LeaderboardSubmission {
  playerName: string;
  score: number;
  mode: GameMode;
  stageReached: number;
  durationMs: number;
  playerCount: number;
}

export interface SubmitResult {
  rank: number | null;
}

export interface LeaderboardRepository {
  submit(entry: LeaderboardSubmission): Promise<SubmitResult>;
  getTopScores(mode: GameMode, limit?: number): Promise<LeaderboardEntry[]>;
}

const MAX_ENTRIES = 20;

export class InMemoryLeaderboardRepository implements LeaderboardRepository {
  private readonly boards = new Map<GameMode, LeaderboardEntry[]>();

  async submit(entry: LeaderboardSubmission): Promise<SubmitResult> {
    const board = this.boards.get(entry.mode) ?? [];
    const newEntry: LeaderboardEntry = {
      id: nanoid(),
      playerName: entry.playerName,
      score: entry.score,
      mode: entry.mode,
      stageReached: entry.stageReached,
      durationMs: entry.durationMs,
      playerCount: entry.playerCount,
      achievedAt: Date.now(),
      rank: 0
    };

    board.push(newEntry);
    board.sort((a, b) => b.score - a.score);
    board.splice(MAX_ENTRIES);
    this.boards.set(entry.mode, board);

    const index = board.findIndex((e) => e.id === newEntry.id);
    if (index === -1) {
      return { rank: null };
    }
    for (let i = 0; i < board.length; i++) {
      board[i]!.rank = i + 1;
    }
    return { rank: index + 1 };
  }

  async getTopScores(mode: GameMode, limit = MAX_ENTRIES): Promise<LeaderboardEntry[]> {
    const board = this.boards.get(mode) ?? [];
    return board.slice(0, limit).map((entry, index) => ({ ...entry, rank: index + 1 }));
  }
}

const scoresKey = (mode: GameMode) => `leaderboard:${mode}:scores`;
const entryKey = (id: string) => `leaderboard:entry:${id}`;

export class RedisLeaderboardRepository implements LeaderboardRepository {
  constructor(private readonly client: RedisClientType) {}

  async submit(entry: LeaderboardSubmission): Promise<SubmitResult> {
    const id = nanoid();
    const key = scoresKey(entry.mode);
    const achievedAt = Date.now();

    await this.client.multi()
      .zAdd(key, { score: entry.score, value: id })
      .hSet(entryKey(id), {
        playerName: entry.playerName,
        mode: entry.mode,
        score: String(entry.score),
        stageReached: String(entry.stageReached),
        durationMs: String(entry.durationMs),
        playerCount: String(entry.playerCount),
        achievedAt: String(achievedAt)
      })
      .exec();

    // Trim to top MAX_ENTRIES — remove entries ranked below MAX_ENTRIES (0-indexed from bottom)
    const count = await this.client.zCard(key);
    if (count > MAX_ENTRIES) {
      const displaced = await this.client.zRange(key, 0, count - MAX_ENTRIES - 1);
      await this.client.multi()
        .zRemRangeByRank(key, 0, count - MAX_ENTRIES - 1)
        .del(displaced.map((displacedId) => entryKey(displacedId)))
        .exec();
    }

    // Check rank (ZREVRANK is 0-based, null if not in set)
    const zRank = await this.client.zRevRank(key, id);
    if (zRank === null) {
      return { rank: null };
    }
    return { rank: zRank + 1 };
  }

  async getTopScores(mode: GameMode, limit = MAX_ENTRIES): Promise<LeaderboardEntry[]> {
    const key = scoresKey(mode);
    const ids = await this.client.zRange(key, 0, limit - 1, { REV: true });
    if (ids.length === 0) {
      return [];
    }

    const entries: LeaderboardEntry[] = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const data = await this.client.hGetAll(entryKey(id));
      if (!data.playerName) {
        continue;
      }
      entries.push({
        id,
        playerName: data.playerName,
        score: Number(data.score),
        mode: data.mode as GameMode,
        stageReached: Number(data.stageReached),
        durationMs: Number(data.durationMs),
        playerCount: Number(data.playerCount),
        achievedAt: Number(data.achievedAt),
        rank: i + 1
      });
    }
    return entries;
  }
}
