import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GAME_WIDTH } from "@shared/index";
import {
  awardScore,
  createEnemy,
  hitPlayer,
  killEnemy,
  resolveCollisions,
  spawnPlayerVolley,
} from "../src/combat.js";
import type { MatchRuntime, RuntimePlayer } from "../src/gameTypes.js";
import {
  BOSS_FIRE_COOLDOWN_MS,
  BOSS_HP_BASE,
  BOSS_INITIAL_VX,
  BOSS_INITIAL_VY,
  BOSS_RADIUS,
  BOSS_SPAWN_Y,
  ENEMY_SPAWN_Y,
  FIGHTER_STATS,
  HEAVY_STATS,
  KAMIKAZE_STATS,
  PLAYER_BULLET_DAMAGE,
  PLAYER_HITBOX_RADIUS,
  SCORE_BOSS,
  SCORE_FIGHTER,
  SCORE_HEAVY,
} from "../src/gameTypes.js";

function createMockPlayer(overrides: Partial<RuntimePlayer> = {}): RuntimePlayer {
  return {
    playerId: "p1",
    name: "TestPilot",
    shipId: "azure",
    x: 640,
    y: 600,
    alive: true,
    bombs: 1,
    weaponLevel: 1,
    score: 0,
    shotCooldownMs: 0,
    respawnMs: 0,
    invulnerableMs: 0,
    pendingBomb: false,
    ...overrides,
  };
}

function createMockMatch(overrides: Partial<MatchRuntime> = {}): MatchRuntime {
  const players = new Map<string, RuntimePlayer>();
  const defaultPlayer = createMockPlayer();
  players.set(defaultPlayer.playerId, defaultPlayer);

  return {
    roomCode: "ABCDE",
    mode: "campaign",
    tick: 0,
    elapsedMs: 0,
    teamLives: 6,
    stageIndex: 0,
    stageElapsedMs: 0,
    stageLabel: "Nebula Run",
    stageBossSpawned: false,
    spawnedWaves: new Set<string>(),
    players,
    enemies: [],
    bullets: [],
    pickups: [],
    pendingEvents: [],
    idCounter: 0,
    survivalSpawnMs: 0,
    survivalBossMs: 0,
    difficultyScale: 1,
    stageTransitionPending: false,
    ...overrides,
  };
}

describe("createEnemy", () => {
  it("creates a fighter with correct stats", () => {
    const match = createMockMatch();
    const enemy = createEnemy(match, "fighter", 0, "w1");
    assert.equal(enemy.kind, "fighter");
    assert.equal(enemy.hp, FIGHTER_STATS.hp);
    assert.equal(enemy.radius, FIGHTER_STATS.radius);
    assert.equal(enemy.y, ENEMY_SPAWN_Y);
    assert.equal(enemy.boss, false);
  });

  it("creates a heavy with correct stats", () => {
    const match = createMockMatch();
    const enemy = createEnemy(match, "heavy", 1, "w2");
    assert.equal(enemy.kind, "heavy");
    assert.equal(enemy.hp, HEAVY_STATS.hp);
    assert.equal(enemy.radius, HEAVY_STATS.radius);
    assert.equal(enemy.boss, false);
  });

  it("creates a kamikaze with correct stats", () => {
    const match = createMockMatch();
    const enemy = createEnemy(match, "kamikaze", 2, "w3");
    assert.equal(enemy.kind, "kamikaze");
    assert.equal(enemy.hp, KAMIKAZE_STATS.hp);
    assert.equal(enemy.radius, KAMIKAZE_STATS.radius);
    assert.equal(enemy.vx, 0);
    assert.equal(enemy.boss, false);
  });

  it("creates a boss with correct stats", () => {
    const match = createMockMatch();
    const enemy = createEnemy(match, "fighter", 0, "w4", true);
    assert.equal(enemy.kind, "boss");
    assert.equal(enemy.boss, true);
    assert.equal(enemy.hp, Math.round(BOSS_HP_BASE * match.difficultyScale));
    assert.equal(enemy.radius, BOSS_RADIUS);
    assert.equal(enemy.x, GAME_WIDTH / 2);
    assert.equal(enemy.y, BOSS_SPAWN_Y);
    assert.equal(enemy.vx, BOSS_INITIAL_VX);
    assert.equal(enemy.vy, BOSS_INITIAL_VY);
    assert.equal(enemy.fireCooldownMs, BOSS_FIRE_COOLDOWN_MS);
  });
});

describe("awardScore", () => {
  it("awards score to an existing player", () => {
    const match = createMockMatch();
    awardScore(match, "p1", 100);
    assert.equal(match.players.get("p1")!.score, 100);
  });

  it("accumulates score across multiple awards", () => {
    const match = createMockMatch();
    awardScore(match, "p1", 50);
    awardScore(match, "p1", 70);
    assert.equal(match.players.get("p1")!.score, 120);
  });

  it("does nothing when playerId is undefined", () => {
    const match = createMockMatch();
    awardScore(match, undefined, 100);
    assert.equal(match.players.get("p1")!.score, 0);
  });

  it("does nothing for a missing player", () => {
    const match = createMockMatch();
    awardScore(match, "nonexistent", 100);
    assert.equal(match.players.get("p1")!.score, 0);
  });
});

describe("spawnPlayerVolley", () => {
  it("spawns 1 bullet at weapon level 1", () => {
    const match = createMockMatch();
    const player = match.players.get("p1")!;
    player.weaponLevel = 1;
    spawnPlayerVolley(match, player);
    assert.equal(match.bullets.length, 1);
    assert.equal(match.bullets[0]!.damage, PLAYER_BULLET_DAMAGE.level1);
  });

  it("spawns 2 bullets at weapon level 2", () => {
    const match = createMockMatch();
    const player = match.players.get("p1")!;
    player.weaponLevel = 2;
    spawnPlayerVolley(match, player);
    assert.equal(match.bullets.length, 2);
    assert.equal(match.bullets[0]!.damage, PLAYER_BULLET_DAMAGE.level2);
  });

  it("spawns 3 bullets at weapon level 3", () => {
    const match = createMockMatch();
    const player = match.players.get("p1")!;
    player.weaponLevel = 3;
    spawnPlayerVolley(match, player);
    assert.equal(match.bullets.length, 3);
    assert.equal(match.bullets[0]!.damage, PLAYER_BULLET_DAMAGE.level3);
  });
});

describe("hitPlayer", () => {
  it("kills an alive player and reduces teamLives", () => {
    const match = createMockMatch();
    const player = match.players.get("p1")!;
    hitPlayer(match, player);
    assert.equal(player.alive, false);
    assert.equal(match.teamLives, 5);
  });

  it("does not hit a dead player", () => {
    const match = createMockMatch();
    const player = match.players.get("p1")!;
    player.alive = false;
    const livesBefore = match.teamLives;
    hitPlayer(match, player);
    assert.equal(match.teamLives, livesBefore);
  });

  it("does not hit an invulnerable player", () => {
    const match = createMockMatch();
    const player = match.players.get("p1")!;
    player.invulnerableMs = 1000;
    hitPlayer(match, player);
    assert.equal(player.alive, true);
    assert.equal(match.teamLives, 6);
  });
});

describe("killEnemy", () => {
  it("removes enemy and awards fighter score", () => {
    const match = createMockMatch();
    const enemy = createEnemy(match, "fighter", 0, "w1");
    match.enemies.push(enemy);
    killEnemy(match, enemy.id, "p1");
    assert.equal(match.enemies.length, 0);
    assert.equal(match.players.get("p1")!.score, SCORE_FIGHTER);
  });

  it("awards heavy score for heavy kill", () => {
    const match = createMockMatch();
    const enemy = createEnemy(match, "heavy", 0, "w1");
    match.enemies.push(enemy);
    killEnemy(match, enemy.id, "p1");
    assert.equal(match.players.get("p1")!.score, SCORE_HEAVY);
  });

  it("awards boss score and sets result on final boss", () => {
    const match = createMockMatch({ stageIndex: 2 });
    const boss = createEnemy(match, "fighter", 0, "w1", true);
    match.enemies.push(boss);
    killEnemy(match, boss.id, "p1");
    assert.equal(match.players.get("p1")!.score, SCORE_BOSS);
    assert.ok(match.result);
    assert.equal(match.result.outcome, "victory");
  });

  it("does nothing for nonexistent enemy id", () => {
    const match = createMockMatch();
    killEnemy(match, "no-such-id", "p1");
    assert.equal(match.players.get("p1")!.score, 0);
  });
});

describe("resolveCollisions", () => {
  it("player bullet hits enemy and removes bullet", () => {
    const match = createMockMatch();
    const enemy = createEnemy(match, "fighter", 0, "w1");
    enemy.x = 100;
    enemy.y = 100;
    match.enemies.push(enemy);
    match.bullets.push({
      id: "pb-1",
      owner: "player",
      ownerId: "p1",
      x: 100,
      y: 100,
      vx: 0,
      vy: -540,
      radius: 5,
      damage: 999,
    });
    resolveCollisions(match);
    assert.equal(match.bullets.length, 0);
    assert.equal(match.enemies.length, 0);
  });

  it("enemy bullet hits player and removes bullet", () => {
    const match = createMockMatch();
    const player = match.players.get("p1")!;
    player.x = 200;
    player.y = 200;
    match.bullets.push({
      id: "eb-1",
      owner: "enemy",
      x: 200,
      y: 200,
      vx: 0,
      vy: 250,
      radius: 6,
      damage: 1,
    });
    resolveCollisions(match);
    assert.equal(match.bullets.length, 0);
    assert.equal(player.alive, false);
  });

  it("boss body collision triggers killEnemy and stage transition", () => {
    const match = createMockMatch({ stageBossSpawned: true });
    const boss = createEnemy(match, "fighter", 0, "w1", true);
    const player = match.players.get("p1")!;
    boss.x = player.x;
    boss.y = player.y;
    match.enemies.push(boss);
    resolveCollisions(match);
    assert.equal(match.enemies.length, 0, "boss should be removed");
    assert.equal(match.stageBossSpawned, false, "stageBossSpawned should reset after boss kill");
    assert.ok(match.pendingEvents.some((e) => e.type === "game_event" && e.payload.kind === "boss_defeated"), "should emit boss_defeated event");
  });

  it("normal enemy body collision removes enemy", () => {
    const match = createMockMatch();
    const enemy = createEnemy(match, "fighter", 0, "w1");
    const player = match.players.get("p1")!;
    enemy.x = player.x;
    enemy.y = player.y;
    match.enemies.push(enemy);
    resolveCollisions(match);
    assert.equal(match.enemies.length, 0, "enemy should be removed after body collision");
    assert.equal(player.alive, false, "player should be killed by body collision");
  });
});
