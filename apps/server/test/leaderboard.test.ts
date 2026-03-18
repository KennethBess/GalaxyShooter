import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WebSocketConnectionGateway } from "../src/connectionGateway.js";
import { InMemoryLeaderboardRepository } from "../src/leaderboardRepository.js";
import { InMemoryRoomDirectory } from "../src/roomDirectory.js";
import { InMemoryRoomMessageBus } from "../src/roomMessageBus.js";
import { InMemoryRoomRepository } from "../src/roomRepository.js";
import { RoomService } from "../src/roomService.js";
import { InMemoryRoomRuntimeRegistry } from "../src/runtimeRegistry.js";
import { parseLeaderboardMode } from "../src/validation.js";
import { FakeSocket, parseMessages } from "./helpers.js";

describe("InMemoryLeaderboardRepository", () => {
  it("submits and retrieves a score", async () => {
    const repo = new InMemoryLeaderboardRepository();
    const result = await repo.submit({
      playerName: "Ace",
      score: 5000,
      mode: "campaign",
      stageReached: 3,
      durationMs: 60000,
      playerCount: 2
    });

    assert.equal(result.rank, 1);

    const entries = await repo.getTopScores("campaign");
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.playerName, "Ace");
    assert.equal(entries[0]!.score, 5000);
    assert.equal(entries[0]!.rank, 1);
  });

  it("sorts entries by score descending", async () => {
    const repo = new InMemoryLeaderboardRepository();
    await repo.submit({ playerName: "Low", score: 100, mode: "campaign", stageReached: 1, durationMs: 10000, playerCount: 1 });
    await repo.submit({ playerName: "High", score: 9000, mode: "campaign", stageReached: 5, durationMs: 90000, playerCount: 1 });
    await repo.submit({ playerName: "Mid", score: 3000, mode: "campaign", stageReached: 3, durationMs: 50000, playerCount: 1 });

    const entries = await repo.getTopScores("campaign");
    assert.equal(entries.length, 3);
    assert.equal(entries[0]!.playerName, "High");
    assert.equal(entries[1]!.playerName, "Mid");
    assert.equal(entries[2]!.playerName, "Low");
    assert.equal(entries[0]!.rank, 1);
    assert.equal(entries[1]!.rank, 2);
    assert.equal(entries[2]!.rank, 3);
  });

  it("trims to top 20 entries", async () => {
    const repo = new InMemoryLeaderboardRepository();
    for (let i = 1; i <= 25; i++) {
      await repo.submit({ playerName: `Player${i}`, score: i * 100, mode: "campaign", stageReached: 1, durationMs: 10000, playerCount: 1 });
    }

    const entries = await repo.getTopScores("campaign");
    assert.equal(entries.length, 20);
    // Highest score should be first
    assert.equal(entries[0]!.score, 2500);
    // Lowest in the top 20 should be 600 (players 6-25 survive, 1-5 are trimmed)
    assert.equal(entries[19]!.score, 600);
  });

  it("returns null rank when score is too low to place", async () => {
    const repo = new InMemoryLeaderboardRepository();
    for (let i = 1; i <= 20; i++) {
      await repo.submit({ playerName: `Player${i}`, score: (i + 1) * 1000, mode: "campaign", stageReached: 1, durationMs: 10000, playerCount: 1 });
    }

    const result = await repo.submit({ playerName: "TooLow", score: 1, mode: "campaign", stageReached: 1, durationMs: 1000, playerCount: 1 });
    assert.equal(result.rank, null);

    const entries = await repo.getTopScores("campaign");
    assert.equal(entries.length, 20);
    assert.ok(!entries.some((e) => e.playerName === "TooLow"));
  });

  it("isolates scores by game mode", async () => {
    const repo = new InMemoryLeaderboardRepository();
    await repo.submit({ playerName: "CampaignAce", score: 5000, mode: "campaign", stageReached: 3, durationMs: 60000, playerCount: 1 });
    await repo.submit({ playerName: "SurvivalAce", score: 8000, mode: "survival", stageReached: 10, durationMs: 120000, playerCount: 1 });

    const campaign = await repo.getTopScores("campaign");
    const survival = await repo.getTopScores("survival");

    assert.equal(campaign.length, 1);
    assert.equal(campaign[0]!.playerName, "CampaignAce");
    assert.equal(survival.length, 1);
    assert.equal(survival[0]!.playerName, "SurvivalAce");
  });

  it("returns correct rank on submit", async () => {
    const repo = new InMemoryLeaderboardRepository();
    await repo.submit({ playerName: "First", score: 1000, mode: "campaign", stageReached: 1, durationMs: 10000, playerCount: 1 });
    await repo.submit({ playerName: "Third", score: 3000, mode: "campaign", stageReached: 2, durationMs: 20000, playerCount: 1 });

    // Insert a score that should land at rank 1
    const result = await repo.submit({ playerName: "Top", score: 5000, mode: "campaign", stageReached: 3, durationMs: 30000, playerCount: 1 });
    assert.equal(result.rank, 1);

    // Insert a score that should land at rank 3
    const midResult = await repo.submit({ playerName: "Middle", score: 2000, mode: "campaign", stageReached: 1, durationMs: 15000, playerCount: 1 });
    assert.equal(midResult.rank, 3);
  });

  it("returns empty array for mode with no entries", async () => {
    const repo = new InMemoryLeaderboardRepository();
    const entries = await repo.getTopScores("survival");
    assert.deepEqual(entries, []);
  });

  it("respects custom limit parameter", async () => {
    const repo = new InMemoryLeaderboardRepository();
    for (let i = 1; i <= 10; i++) {
      await repo.submit({ playerName: `Player${i}`, score: i * 100, mode: "campaign", stageReached: 1, durationMs: 10000, playerCount: 1 });
    }

    const top5 = await repo.getTopScores("campaign", 5);
    assert.equal(top5.length, 5);
    assert.equal(top5[0]!.score, 1000);
  });
});

describe("InMemoryLeaderboardRepository.deleteEntry", () => {
  it("deletes an existing entry and returns true", async () => {
    const repo = new InMemoryLeaderboardRepository();
    await repo.submit({ playerName: "Ace", score: 5000, mode: "campaign", stageReached: 3, durationMs: 60000, playerCount: 1 });
    const entries = await repo.getTopScores("campaign");
    const id = entries[0]!.id;

    const result = await repo.deleteEntry(id);
    assert.equal(result, true);

    const after = await repo.getTopScores("campaign");
    assert.equal(after.length, 0);
  });

  it("returns false for non-existent ID", async () => {
    const repo = new InMemoryLeaderboardRepository();
    const result = await repo.deleteEntry("does-not-exist");
    assert.equal(result, false);
  });

  it("after deletion getTopScores returns updated list", async () => {
    const repo = new InMemoryLeaderboardRepository();
    await repo.submit({ playerName: "Alpha", score: 3000, mode: "campaign", stageReached: 2, durationMs: 30000, playerCount: 1 });
    await repo.submit({ playerName: "Bravo", score: 5000, mode: "campaign", stageReached: 4, durationMs: 60000, playerCount: 1 });
    await repo.submit({ playerName: "Charlie", score: 1000, mode: "campaign", stageReached: 1, durationMs: 10000, playerCount: 1 });

    const before = await repo.getTopScores("campaign");
    assert.equal(before.length, 3);
    // Bravo is rank 1 (highest score)
    const bravoId = before[0]!.id;
    assert.equal(before[0]!.playerName, "Bravo");

    await repo.deleteEntry(bravoId);

    const after = await repo.getTopScores("campaign");
    assert.equal(after.length, 2);
    assert.equal(after[0]!.playerName, "Alpha");
    assert.equal(after[0]!.rank, 1);
    assert.equal(after[1]!.playerName, "Charlie");
    assert.equal(after[1]!.rank, 2);
  });
});

describe("parseLeaderboardMode", () => {
  it("accepts 'campaign'", () => {
    assert.equal(parseLeaderboardMode("campaign"), "campaign");
  });

  it("accepts 'survival'", () => {
    assert.equal(parseLeaderboardMode("survival"), "survival");
  });

  it("rejects invalid mode", () => {
    assert.throws(() => parseLeaderboardMode("endless"));
  });

  it("rejects undefined", () => {
    assert.throws(() => parseLeaderboardMode(undefined));
  });

  it("rejects empty string", () => {
    assert.throws(() => parseLeaderboardMode(""));
  });
});

describe("leaderboardRank in match result", () => {
  it("match result includes leaderboardRank after match ends", async () => {
    const runtimeRegistry = new InMemoryRoomRuntimeRegistry();
    const leaderboard = new InMemoryLeaderboardRepository();
    const service = new RoomService(
      new InMemoryRoomRepository(),
      runtimeRegistry,
      new WebSocketConnectionGateway(),
      new InMemoryRoomDirectory(),
      new InMemoryRoomMessageBus(),
      "test",
      3600,
      leaderboard
    );

    const host = await service.createRoom("Host", "azure");
    const hostSocket = new FakeSocket();
    await service.connectPlayer(host.roomCode, host.playerId, hostSocket as never);
    await service.handleMessage(host.roomCode, host.playerId, { type: "start_match" });
    await service.tick(50);

    // Force a match result
    const runtime = runtimeRegistry.get(host.roomCode);
    assert.ok(runtime?.match);
    runtime.match.result = {
      outcome: "victory",
      mode: "campaign",
      score: 5000,
      stageReached: 3,
      durationMs: 60000,
      players: [{ playerId: host.playerId, name: "Host", shipId: "azure", score: 5000 }],
      leaderboardRank: null
    };

    await service.tick(50);

    const matchResults = parseMessages<{ type: string; payload?: { leaderboardRank?: number | null } }>(hostSocket)
      .filter((m) => m.type === "match_result");
    assert.equal(matchResults.length, 1);
    assert.equal(matchResults[0]!.payload!.leaderboardRank, 1);

    // Verify the score was persisted to the leaderboard
    const entries = await leaderboard.getTopScores("campaign");
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.playerName, "Host");
    assert.equal(entries[0]!.score, 5000);
  });
});
