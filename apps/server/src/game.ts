import { GAME_HEIGHT, GAME_WIDTH, PLAYER_FIRE_INTERVAL_MS, PLAYER_SPEED, TEAM_LIVES_BASE } from "../../../packages/shared/src/index.js";
import type {
  EnemyKind,
  GameEventMessage,
  GameMode,
  PlayerSlot,
  ShipId,
  ResultSummary,
  SnapshotState,
  StageDef
} from "../../../packages/shared/src/index.js";
import { BOSS_PHASES, CAMPAIGN_STAGES } from "./stages.js";
import {
  clamp, getStage, getStageHotStartMs, LANES, queueEvent,
  BOSS_ENTER_Y, BOSS_WALL_MARGIN,
  BOMB_DAMAGE_BOSS, BOMB_DAMAGE_NORMAL,
  DIFFICULTY_EXTRA_PER_PLAYER, INVULNERABLE_AFTER_RESPAWN_MS,
  KAMIKAZE_MIN_VY, KAMIKAZE_STATS,
  PLAYER_CLAMP_X_MIN, PLAYER_CLAMP_X_MAX_OFFSET, PLAYER_CLAMP_Y_MIN, PLAYER_CLAMP_Y_MAX_OFFSET,
  PLAYER_SPAWN_SPACING, PLAYER_SPAWN_Y_OFFSET,
  SURVIVAL_BOSS_INTERVAL_MS, SURVIVAL_INITIAL_BOSS_MS, SURVIVAL_INITIAL_SPAWN_MS,
  SURVIVAL_SPAWN_BASE_MS, SURVIVAL_SPAWN_MIN_MS, SURVIVAL_SPAWN_REDUCTION_PER_STAGE,
  SURVIVAL_STAGE_DURATION_MS,
  WAVE_EXTRA_SCALE, WAVE_SPACING_Y,
  type InputState, type MatchRuntime, type RuntimePlayer
} from "./gameTypes.js";
import {
  createEnemy, fireEnemy, hitPlayer, killEnemy,
  resolveCollisions, spawnPlayerVolley
} from "./combat.js";

export type { MatchRuntime, InputState } from "./gameTypes.js";

const processWaves = (match: MatchRuntime) => {
  if (match.mode === "campaign") {
    const stage = getStage(match);
    for (const wave of stage.waves) {
      if (match.spawnedWaves.has(wave.id) || match.stageElapsedMs < wave.timeMs) {
        continue;
      }
      match.spawnedWaves.add(wave.id);
      const count = wave.count + Math.floor((match.difficultyScale - 1) * WAVE_EXTRA_SCALE);
      for (let index = 0; index < count; index += 1) {
        const enemy = createEnemy(match, wave.kind, wave.lane + index, wave.id);
        enemy.y -= index * WAVE_SPACING_Y;
        match.enemies.push(enemy);
      }
    }

    if (!match.stageBossSpawned && match.stageElapsedMs >= stage.durationMs) {
      match.stageBossSpawned = true;
      match.enemies.push(createEnemy(match, "boss", 2, stage.bossId, true));
    }
    return;
  }

  if (match.elapsedMs >= match.survivalSpawnMs) {
    match.survivalSpawnMs = match.elapsedMs + clamp(SURVIVAL_SPAWN_BASE_MS - match.stageIndex * SURVIVAL_SPAWN_REDUCTION_PER_STAGE, SURVIVAL_SPAWN_MIN_MS, SURVIVAL_SPAWN_BASE_MS);
    const kinds: EnemyKind[] = ["fighter", "fighter", "heavy", "kamikaze"];
    const kind = kinds[match.tick % kinds.length] ?? "fighter";
    const enemy = createEnemy(match, kind, match.tick % LANES.length, `survival-${match.tick}`);
    match.enemies.push(enemy);
    if (match.tick % 3 === 0) {
      match.enemies.push(createEnemy(match, "fighter", (match.tick + 2) % LANES.length, `survival-${match.tick}-b`));
    }
  }

  if (match.elapsedMs >= match.survivalBossMs && !match.enemies.some((enemy) => enemy.boss)) {
    match.enemies.push(createEnemy(match, "boss", 2, `survival-boss-${match.tick}`, true));
    queueEvent(match, "boss_phase", `Survival boss inbound`);
    match.survivalBossMs = match.elapsedMs + SURVIVAL_BOSS_INTERVAL_MS;
  }
};

const updatePlayers = (match: MatchRuntime, inputs: Map<string, InputState>, deltaMs: number) => {
  for (const player of match.players.values()) {
    if (player.respawnMs > 0) {
      player.respawnMs -= deltaMs;
      if (player.respawnMs <= 0) {
        player.alive = true;
        player.invulnerableMs = INVULNERABLE_AFTER_RESPAWN_MS;
        player.x = GAME_WIDTH / 2;
        player.y = GAME_HEIGHT - PLAYER_SPAWN_Y_OFFSET;
        queueEvent(match, "player_respawn", `${player.name} is back in formation`);
      }
    }
    player.invulnerableMs = Math.max(0, player.invulnerableMs - deltaMs);
    player.shotCooldownMs = Math.max(0, player.shotCooldownMs - deltaMs);

    if (!player.alive) {
      continue;
    }

    const input = inputs.get(player.playerId) ?? { up: false, down: false, left: false, right: false, shoot: false };
    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    const length = Math.hypot(dx, dy) || 1;
    player.x = clamp(player.x + ((dx / length) * PLAYER_SPEED * deltaMs) / 1000, PLAYER_CLAMP_X_MIN, GAME_WIDTH - PLAYER_CLAMP_X_MAX_OFFSET);
    player.y = clamp(player.y + ((dy / length) * PLAYER_SPEED * deltaMs) / 1000, PLAYER_CLAMP_Y_MIN, GAME_HEIGHT - PLAYER_CLAMP_Y_MAX_OFFSET);

    if (player.pendingBomb && player.bombs > 0) {
      player.pendingBomb = false;
      player.bombs -= 1;
      match.bullets = match.bullets.filter((bullet) => bullet.owner !== "enemy");
      for (const enemy of match.enemies) {
        enemy.hp -= enemy.boss ? BOMB_DAMAGE_BOSS : BOMB_DAMAGE_NORMAL;
      }
    }

    if (input.shoot && player.shotCooldownMs === 0) {
      spawnPlayerVolley(match, player);
      player.shotCooldownMs = PLAYER_FIRE_INTERVAL_MS;
    }
  }
};

const updateEnemies = (match: MatchRuntime, deltaMs: number) => {
  for (const enemy of match.enemies) {
    if (enemy.boss) {
      enemy.entered = enemy.entered || enemy.y >= BOSS_ENTER_Y;
      enemy.y = enemy.entered ? enemy.y : enemy.y + (enemy.vy * deltaMs) / 1000;
      enemy.x += (enemy.vx * deltaMs) / 1000;
      if (enemy.x < BOSS_WALL_MARGIN || enemy.x > GAME_WIDTH - BOSS_WALL_MARGIN) {
        enemy.vx *= -1;
      }
      const hpRatio = enemy.hp / enemy.maxHp;
      const nextPhase = BOSS_PHASES.findIndex((phase) => hpRatio > phase.threshold);
      const clampedPhase = clamp(nextPhase === -1 ? BOSS_PHASES.length - 1 : nextPhase, 0, BOSS_PHASES.length - 1);
      if (clampedPhase !== enemy.phase) {
        enemy.phase = clampedPhase;
        queueEvent(match, "boss_phase", `${match.stageLabel} boss phase ${enemy.phase + 1}`);
      }
    } else {
      enemy.x += (enemy.vx * deltaMs) / 1000;
      enemy.y += (enemy.vy * deltaMs) / 1000;
      if (enemy.kind === "kamikaze") {
        const target = [...match.players.values()].find((player) => player.alive);
        if (target) {
          const dx = target.x - enemy.x;
          const dy = target.y - enemy.y;
          const length = Math.hypot(dx, dy) || 1;
          enemy.vx = (dx / length) * KAMIKAZE_STATS.speed;
          enemy.vy = Math.max(KAMIKAZE_MIN_VY, (dy / length) * KAMIKAZE_STATS.speed);
        }
      }
    }

    enemy.fireCooldownMs -= deltaMs;
    if (enemy.fireCooldownMs <= 0) {
      fireEnemy(match, enemy);
    }
  }
  match.enemies = match.enemies.filter((enemy) => enemy.y <= GAME_HEIGHT + 100 && enemy.hp > 0);
};

const updateBullets = (match: MatchRuntime, deltaMs: number) => {
  for (const bullet of match.bullets) {
    bullet.x += (bullet.vx * deltaMs) / 1000;
    bullet.y += (bullet.vy * deltaMs) / 1000;
  }
  match.bullets = match.bullets.filter((bullet) => bullet.y >= -60 && bullet.y <= GAME_HEIGHT + 60 && bullet.x >= -60 && bullet.x <= GAME_WIDTH + 60);
};

const updatePickups = (match: MatchRuntime, deltaMs: number) => {
  for (const pickup of match.pickups) {
    pickup.y += (pickup.vy * deltaMs) / 1000;
  }
  match.pickups = match.pickups.filter((pickup) => pickup.y <= GAME_HEIGHT + 40);
};

export const createMatch = (roomCode: string, mode: GameMode, players: PlayerSlot[]): MatchRuntime => {
  const runtimePlayers = new Map<string, RuntimePlayer>();
  players.forEach((player, index) => {
    runtimePlayers.set(player.playerId, {
      playerId: player.playerId,
      name: player.name,
      shipId: player.shipId,
      x: GAME_WIDTH / 2 + (index - (players.length - 1) / 2) * PLAYER_SPAWN_SPACING,
      y: GAME_HEIGHT - PLAYER_SPAWN_Y_OFFSET,
      alive: true,
      bombs: 1,
      weaponLevel: 1,
      score: 0,
      shotCooldownMs: 0,
      respawnMs: 0,
      invulnerableMs: 0,
      pendingBomb: false
    });
  });

  return {
    roomCode,
    mode,
    tick: 0,
    elapsedMs: 0,
    teamLives: Math.max(TEAM_LIVES_BASE, players.length * 2 + 2),
    stageIndex: mode === "campaign" ? 0 : 1,
    stageElapsedMs: 0,
    stageLabel: mode === "campaign" ? CAMPAIGN_STAGES[0]!.label : "Survival 1",
    stageBossSpawned: false,
    spawnedWaves: new Set<string>(),
    players: runtimePlayers,
    enemies: [],
    bullets: [],
    pickups: [],
    pendingEvents: [],
    idCounter: 0,
    survivalSpawnMs: SURVIVAL_INITIAL_SPAWN_MS,
    survivalBossMs: SURVIVAL_INITIAL_BOSS_MS,
    difficultyScale: 1 + (players.length - 1) * DIFFICULTY_EXTRA_PER_PLAYER,
    stageTransitionPending: false
  };
};

export const queueBomb = (match: MatchRuntime, playerId: string) => {
  const player = match.players.get(playerId);
  if (player) {
    player.pendingBomb = true;
  }
};

export const updateMatch = (match: MatchRuntime, inputs: Map<string, InputState>, deltaMs: number): { snapshot: SnapshotState; events: GameEventMessage[]; result?: ResultSummary } => {
  if (!match.result) {
    match.tick += 1;
    match.elapsedMs += deltaMs;
    match.stageElapsedMs += deltaMs;

    processWaves(match);
    updatePlayers(match, inputs, deltaMs);
    updateEnemies(match, deltaMs);
    updateBullets(match, deltaMs);
    updatePickups(match, deltaMs);
    resolveCollisions(match);
    if (match.stageTransitionPending) {
      match.enemies = [];
      match.bullets = [];
      match.pickups = [];
      match.stageTransitionPending = false;
    }

    if (match.mode === "survival") {
      match.stageIndex = Math.max(1, Math.floor(match.elapsedMs / SURVIVAL_STAGE_DURATION_MS) + 1);
      match.stageLabel = `Survival ${match.stageIndex}`;
    }
  }

  const events = [...match.pendingEvents];
  match.pendingEvents = [];
  const snapshot: SnapshotState = {
    tick: match.tick,
    roomCode: match.roomCode,
    mode: match.mode,
    stageIndex: match.stageIndex + (match.mode === "campaign" ? 1 : 0),
    stageLabel: match.stageLabel,
    elapsedMs: match.elapsedMs,
    teamLives: match.teamLives,
    score: [...match.players.values()].reduce((sum, current) => sum + current.score, 0),
    players: [...match.players.values()].map((player) => ({
      playerId: player.playerId,
      name: player.name,
      shipId: player.shipId,
      x: player.x,
      y: player.y,
      alive: player.alive,
      bombs: player.bombs,
      weaponLevel: player.weaponLevel,
      score: player.score
    })),
    enemies: match.enemies.map((enemy) => ({
      id: enemy.id,
      kind: enemy.kind,
      x: enemy.x,
      y: enemy.y,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      radius: enemy.radius,
      phase: enemy.boss ? enemy.phase : undefined
    })),
    bullets: match.bullets.map((bullet) => ({
      id: bullet.id,
      owner: bullet.owner,
      x: bullet.x,
      y: bullet.y,
      radius: bullet.radius
    })),
    pickups: match.pickups.map((pickup) => ({
      id: pickup.id,
      kind: pickup.kind,
      x: pickup.x,
      y: pickup.y
    }))
  };

  return { snapshot, events, result: match.result };
};




