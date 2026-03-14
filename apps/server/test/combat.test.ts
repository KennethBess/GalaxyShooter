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
import { createMatch, updateMatch } from "../src/game.js";
import type { InputState, MatchRuntime, RuntimePlayer } from "../src/gameTypes.js";
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
  PLAYER_BULLET_RADIUS,
  PLAYER_HITBOX_RADIUS,
  RAPID_FIRE_DURATION_MS,
  SCORE_BOSS,
  SCORE_FIGHTER,
  SCORE_HEAVY,
  SHIELD_DURATION_MS,
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
    shieldMs: 0,
    rapidFireMs: 0,
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

  it("does not damage a player with shield active", () => {
    const match = createMockMatch();
    const player = match.players.get("p1")!;
    player.shieldMs = 5000;
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
      prevX: 100,
      prevY: 100,
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
      prevX: 200,
      prevY: 200,
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

  it("edge-grazing bullet registers a hit via swept segment detection", () => {
    const match = createMockMatch();
    const enemy = createEnemy(match, "fighter", 0, "w1");
    // Place enemy at a known position
    enemy.x = 200;
    enemy.y = 200;
    match.enemies.push(enemy);

    // Bullet travels from (175, 170) to (175, 230) — a vertical path.
    // Neither endpoint is within hit radius of the enemy center (200, 200),
    // but the closest point on the segment is (175, 200), which is 25 px away.
    // Combined radius = PLAYER_BULLET_RADIUS (8) + FIGHTER_STATS.radius (20) = 28.
    // 25 < 28, so the swept segment check should register a hit.
    const startX = 175;
    const startY = 170;
    const endX = 175;
    const endY = 230;

    // Verify neither endpoint alone would trigger a hit (point-based check would miss)
    const endpointDistSqStart = (startX - enemy.x) ** 2 + (startY - enemy.y) ** 2;
    const endpointDistSqEnd = (endX - enemy.x) ** 2 + (endY - enemy.y) ** 2;
    const hitRadiusSq = (PLAYER_BULLET_RADIUS + FIGHTER_STATS.radius) ** 2;
    assert.ok(endpointDistSqStart > hitRadiusSq, "start position should be outside hit radius");
    assert.ok(endpointDistSqEnd > hitRadiusSq, "end position should be outside hit radius");

    match.bullets.push({
      id: "pb-edge",
      owner: "player",
      ownerId: "p1",
      x: endX,
      y: endY,
      prevX: startX,
      prevY: startY,
      vx: 0,
      vy: -540,
      radius: PLAYER_BULLET_RADIUS,
      damage: 999,
    });

    resolveCollisions(match);
    assert.equal(match.bullets.length, 0, "bullet should be consumed on hit");
    assert.equal(match.enemies.length, 0, "enemy should be killed by edge-grazing bullet");
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

describe("power-up pickup collection", () => {
  it("collecting shield pickup sets shieldMs on player", () => {
    const match = createMockMatch();
    const player = match.players.get("p1")!;
    player.x = 300;
    player.y = 300;
    match.pickups.push({ id: "pu-1", kind: "shield", x: 300, y: 300, vy: 0 });
    resolveCollisions(match);
    assert.equal(match.pickups.length, 0, "pickup should be consumed");
    assert.equal(player.shieldMs, SHIELD_DURATION_MS);
  });

  it("collecting rapid_fire pickup sets rapidFireMs on player", () => {
    const match = createMockMatch();
    const player = match.players.get("p1")!;
    player.x = 300;
    player.y = 300;
    match.pickups.push({ id: "pu-2", kind: "rapid_fire", x: 300, y: 300, vy: 0 });
    resolveCollisions(match);
    assert.equal(match.pickups.length, 0, "pickup should be consumed");
    assert.equal(player.rapidFireMs, RAPID_FIRE_DURATION_MS);
  });
});

describe("Nebula Run full boss fight simulation", () => {
  it("completes Nebula Run without crash or infinite loop", () => {
    const match = createMatch("TEST1", "campaign", [
      { playerId: "p1", name: "TestPilot", shipId: "azure", isHost: true, connected: true },
    ]);
    const inputs = new Map<string, InputState>();
    inputs.set("p1", { up: false, down: false, left: false, right: false, shoot: true });
    const deltaMs = 33;

    // Keep player invulnerable so they survive the whole simulation
    match.players.get("p1")!.invulnerableMs = 999999;

    // Phase 1: Run through Nebula Run waves until boss spawns (~727 ticks at 33ms)
    let bossSpawnTick = -1;
    for (let i = 0; i < 800; i++) {
      updateMatch(match, inputs, deltaMs);
      if (match.stageBossSpawned && bossSpawnTick === -1) {
        bossSpawnTick = match.tick;
      }
    }

    assert.ok(match.stageBossSpawned, "Boss should have spawned after stage duration");
    assert.ok(bossSpawnTick > 0, "Boss spawn tick should be recorded");

    // Phase 2: Inject player bullets on the boss each tick until it dies
    const MAX_BOSS_FIGHT_TICKS = 500;
    let bossDied = false;
    for (let i = 0; i < MAX_BOSS_FIGHT_TICKS; i++) {
      const boss = match.enemies.find((e) => e.boss);
      if (boss) {
        match.bullets.push({
          id: `test-pb-${i}`,
          owner: "player",
          ownerId: "p1",
          x: boss.x,
          y: boss.y,
          prevX: boss.x,
          prevY: boss.y,
          vx: 0,
          vy: -540,
          radius: 5,
          damage: 50,
        });
      }

      updateMatch(match, inputs, deltaMs);

      if (match.stageLabel === "Carrier Graveyard") {
        bossDied = true;
        break;
      }
    }

    assert.ok(bossDied, "Boss should have been defeated");
    assert.equal(match.stageLabel, "Carrier Graveyard", "Stage should transition to Carrier Graveyard");
    assert.equal(match.stageIndex, 1, "stageIndex should be 1 after clearing first stage");
    assert.equal(match.result, undefined, "Game should not be over (not final stage)");

    // Phase 3: Verify the game continues for 100 more ticks without errors
    for (let i = 0; i < 100; i++) {
      updateMatch(match, inputs, deltaMs);
    }
    assert.ok(match.tick > 900, "Game should continue running after stage transition");
  });
});
