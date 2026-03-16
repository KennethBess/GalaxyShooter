import type { EnemyKind } from "@shared/index";
import { GAME_WIDTH, PLAYER_RESPAWN_MS } from "@shared/index";
import {
  BOSS_FIRE_COOLDOWN_MS, BOSS_HP_BASE, BOSS_INITIAL_VX, BOSS_INITIAL_VY, BOSS_RADIUS, BOSS_SPAWN_Y,
  clamp, distanceSq, 
  ENEMY_BULLET_RADIUS_LARGE, ENEMY_BULLET_RADIUS_SMALL, ENEMY_BULLET_SPEED_BASE, ENEMY_BULLET_SPEED_HEAVY,
  ENEMY_DRIFT_SPEED, ENEMY_SPAWN_Y,
  FIGHTER_FIRE_COOLDOWN_MS, FIGHTER_STATS, 
  getStage, getStageHotStartMs,HEAVY_FIRE_COOLDOWN_MS, HEAVY_STATS,
  KAMIKAZE_STATS, LANES, 
  type MatchRuntime, nextId,
  PICKUP_BOSS_DROP_SPEED, PICKUP_COLLECT_RADIUS, PICKUP_DROP_SPEED,
  PLAYER_BULLET_DAMAGE, PLAYER_BULLET_OFFSET_Y, PLAYER_BULLET_RADIUS, PLAYER_BULLET_SPEED,
  PLAYER_HITBOX_RADIUS, queueEvent,
  LASER_BEAM_HALF_WIDTH, LASER_DAMAGE_PER_TICK, LASER_DURATION_MS,
  RAPID_FIRE_DURATION_MS, type RuntimeBullet, type RuntimeEnemy, type RuntimePickup, type RuntimePlayer,
  SCORE_BOSS, SCORE_FIGHTER, SCORE_HEAVY,SHIELD_DURATION_MS,
  SURVIVAL_BOSS_INTERVAL_MS, segmentPointDistanceSq
} from "./gameTypes.js";
import { BOSS_PHASES, CAMPAIGN_STAGES } from "./stages.js";

export const createEnemy = (match: MatchRuntime, kind: EnemyKind, lane: number, waveId: string, boss = false): RuntimeEnemy => {
  if (boss) {
    return {
      id: nextId(match, "boss"),
      kind: "boss",
      x: GAME_WIDTH / 2,
      y: BOSS_SPAWN_Y,
      prevX: GAME_WIDTH / 2,
      prevY: BOSS_SPAWN_Y,
      vx: BOSS_INITIAL_VX,
      vy: BOSS_INITIAL_VY,
      hp: Math.round(BOSS_HP_BASE * match.difficultyScale),
      maxHp: Math.round(BOSS_HP_BASE * match.difficultyScale),
      radius: BOSS_RADIUS,
      fireCooldownMs: BOSS_FIRE_COOLDOWN_MS,
      waveId,
      boss: true,
      phase: 0,
      entered: false
    };
  }

  const base =
    kind === "fighter"
      ? FIGHTER_STATS
      : kind === "heavy"
        ? HEAVY_STATS
        : KAMIKAZE_STATS;

  const spawnX = LANES[lane % LANES.length] ?? GAME_WIDTH / 2;
  return {
    id: nextId(match, "enemy"),
    kind,
    x: spawnX,
    y: ENEMY_SPAWN_Y,
    prevX: spawnX,
    prevY: ENEMY_SPAWN_Y,
    vx: kind === "kamikaze" ? 0 : ((lane % 2 === 0 ? 1 : -1) * ENEMY_DRIFT_SPEED),
    vy: base.speed,
    hp: Math.round(base.hp * match.difficultyScale),
    maxHp: Math.round(base.hp * match.difficultyScale),
    radius: base.radius,
    fireCooldownMs: base.cooldown,
    waveId,
    boss: false,
    phase: 0,
    entered: false
  };
};

export const awardScore = (match: MatchRuntime, playerId: string | undefined, points: number) => {
  if (!playerId) {
    return;
  }
  const player = match.players.get(playerId);
  if (player) {
    player.score += points;
  }
};

export const maybeDropPickup = (match: MatchRuntime, enemy: RuntimeEnemy) => {
  if (enemy.boss) {
    match.pickups.push({ id: nextId(match, "pickup"), kind: "shield", x: enemy.x, y: enemy.y, vy: PICKUP_BOSS_DROP_SPEED });
    return;
  }
  if (match.idCounter % 5 === 0) {
    match.pickups.push({ id: nextId(match, "pickup"), kind: "rapid_fire", x: enemy.x, y: enemy.y, vy: PICKUP_DROP_SPEED });
  } else if (match.idCounter % 7 === 0) {
    match.pickups.push({ id: nextId(match, "pickup"), kind: "weapon", x: enemy.x, y: enemy.y, vy: PICKUP_DROP_SPEED });
  } else if (match.idCounter % 11 === 0) {
    match.pickups.push({ id: nextId(match, "pickup"), kind: "laser", x: enemy.x, y: enemy.y, vy: PICKUP_DROP_SPEED });
  }
};

export const spawnPlayerVolley = (match: MatchRuntime, player: RuntimePlayer) => {
  const offsets = player.weaponLevel >= 3 ? [-14, 0, 14] : player.weaponLevel === 2 ? [-8, 8] : [0];
  for (const offset of offsets) {
    match.bullets.push({
      id: nextId(match, "pb"),
      owner: "player",
      ownerId: player.playerId,
      x: player.x + offset,
      y: player.y + PLAYER_BULLET_OFFSET_Y,
      prevX: player.x + offset,
      prevY: player.y + PLAYER_BULLET_OFFSET_Y,
      vx: offset * 2.5,
      vy: PLAYER_BULLET_SPEED,
      radius: PLAYER_BULLET_RADIUS,
      damage: player.weaponLevel >= 3 ? PLAYER_BULLET_DAMAGE.level3 : player.weaponLevel === 2 ? PLAYER_BULLET_DAMAGE.level2 : PLAYER_BULLET_DAMAGE.level1
    });
  }
};

export const fireEnemy = (match: MatchRuntime, enemy: RuntimeEnemy) => {
  if (enemy.kind === "kamikaze") {
    return;
  }
  if (enemy.boss) {
    const volleyOffsets = enemy.phase === 0 ? [-56, 0, 56] : enemy.phase === 1 ? [-84, -28, 28, 84] : [-112, -56, 0, 56, 112];
    for (const offset of volleyOffsets) {
      match.bullets.push({
        id: nextId(match, "eb"),
        owner: "enemy",
        x: enemy.x + offset,
        y: enemy.y + 18,
        prevX: enemy.x + offset,
        prevY: enemy.y + 18,
        vx: 0,
        vy: ENEMY_BULLET_SPEED_BASE + Math.abs(offset) * 0.25,
        radius: ENEMY_BULLET_RADIUS_LARGE - 1,
        damage: 1
      });
    }
    enemy.fireCooldownMs = BOSS_PHASES[enemy.phase]?.fireIntervalMs ?? 500;
    return;
  }

  match.bullets.push({
    id: nextId(match, "eb"),
    owner: "enemy",
    x: enemy.x,
    y: enemy.y + enemy.radius / 2,
    prevX: enemy.x,
    prevY: enemy.y + enemy.radius / 2,
    vx: 0,
    vy: enemy.kind === "heavy" ? ENEMY_BULLET_SPEED_HEAVY : ENEMY_BULLET_SPEED_BASE,
    radius: enemy.kind === "heavy" ? ENEMY_BULLET_RADIUS_LARGE : ENEMY_BULLET_RADIUS_SMALL,
    damage: 1
  });
  enemy.fireCooldownMs = enemy.kind === "heavy" ? HEAVY_FIRE_COOLDOWN_MS : FIGHTER_FIRE_COOLDOWN_MS;
};

export const hitPlayer = (match: MatchRuntime, player: RuntimePlayer) => {
  if (!player.alive || player.invulnerableMs > 0 || player.shieldMs > 0) {
    return;
  }
  player.alive = false;
  player.respawnMs = match.teamLives > 0 ? PLAYER_RESPAWN_MS : 0;
  queueEvent(match, "player_hit", `${player.name} took a hit`);
  if (match.teamLives > 0) {
    match.teamLives -= 1;
  }
  if (match.teamLives === 0 && [...match.players.values()].every((candidate) => !candidate.alive)) {
    match.result = {
      outcome: "defeat",
      mode: match.mode,
      score: [...match.players.values()].reduce((sum, current) => sum + current.score, 0),
      stageReached: match.mode === "campaign" ? match.stageIndex + 1 : match.stageIndex,
      durationMs: match.elapsedMs,
      players: [...match.players.values()].map((current) => ({ playerId: current.playerId, name: current.name, shipId: current.shipId, score: current.score })),
      leaderboardRank: null
    };
  }
};

export const killEnemy = (match: MatchRuntime, enemyId: string, ownerId?: string) => {
  const enemyIndex = match.enemies.findIndex((enemy) => enemy.id === enemyId);
  if (enemyIndex === -1) {
    return;
  }
  const enemy = match.enemies[enemyIndex]!;
  match.enemies.splice(enemyIndex, 1);
  awardScore(match, ownerId, enemy.boss ? SCORE_BOSS : enemy.kind === "heavy" ? SCORE_HEAVY : SCORE_FIGHTER);
  maybeDropPickup(match, enemy);

  if (enemy.boss) {
    queueEvent(match, "boss_defeated", `${match.stageLabel} boss defeated`);
    match.bullets = match.bullets.filter((bullet) => bullet.owner !== "enemy");
    if (match.mode === "campaign") {
      if (match.stageIndex >= CAMPAIGN_STAGES.length - 1) {
        match.result = {
          outcome: "victory",
          mode: match.mode,
          score: [...match.players.values()].reduce((sum, current) => sum + current.score, 0),
          stageReached: CAMPAIGN_STAGES.length,
          durationMs: match.elapsedMs,
          players: [...match.players.values()].map((current) => ({ playerId: current.playerId, name: current.name, shipId: current.shipId, score: current.score })),
          leaderboardRank: null
        };
      } else {
        const clearedStageLabel = match.stageLabel;
        match.stageIndex += 1;
        const nextStage = getStage(match);
        match.stageElapsedMs = getStageHotStartMs(nextStage);
        match.stageBossSpawned = false;
        match.spawnedWaves.clear();
        match.stageTransitionPending = true;
        match.stageLabel = nextStage.label;
        queueEvent(match, "stage_clear", `${clearedStageLabel} clear. ${match.stageLabel} online`);
      }
    } else {
      match.stageIndex += 1;
      match.stageLabel = `Survival ${match.stageIndex}`;
      match.survivalBossMs = match.elapsedMs + SURVIVAL_BOSS_INTERVAL_MS;
    }
  }
};

export const resolveLaserBeam = (match: MatchRuntime, player: RuntimePlayer) => {
  const beamX = player.x;
  const beamTop = 0;
  const beamBottom = player.y + PLAYER_BULLET_OFFSET_Y;
  for (const enemy of match.enemies) {
    if (enemy.y < beamTop || enemy.y > beamBottom + enemy.radius) {
      continue;
    }
    const horizontalDist = Math.abs(enemy.x - beamX);
    if (horizontalDist < LASER_BEAM_HALF_WIDTH + enemy.radius) {
      enemy.hp -= LASER_DAMAGE_PER_TICK;
      if (enemy.hp <= 0) {
        killEnemy(match, enemy.id, player.playerId);
      }
    }
  }
};

export const resolveCollisions = (match: MatchRuntime) => {
  const remainingBullets: RuntimeBullet[] = [];
  for (const bullet of match.bullets) {
    if (bullet.owner === "player") {
      let hit = false;
      for (const enemy of match.enemies) {
        if (segmentPointDistanceSq(bullet.prevX, bullet.prevY, bullet.x, bullet.y, enemy.x, enemy.y) <= (bullet.radius + enemy.radius) ** 2) {
          enemy.hp -= bullet.damage;
          hit = true;
          if (enemy.hp <= 0) {
            killEnemy(match, enemy.id, bullet.ownerId);
          }
          break;
        }
      }
      if (!hit) {
        remainingBullets.push(bullet);
      }
      continue;
    }

    let hitPlayerAny = false;
    for (const player of match.players.values()) {
      if (!player.alive || player.invulnerableMs > 0) {
        continue;
      }
      if (segmentPointDistanceSq(bullet.prevX, bullet.prevY, bullet.x, bullet.y, player.x, player.y) <= (bullet.radius + PLAYER_HITBOX_RADIUS) ** 2) {
        hitPlayer(match, player);
        hitPlayerAny = true;
        break;
      }
    }
    if (!hitPlayerAny) {
      remainingBullets.push(bullet);
    }
  }
  match.bullets = remainingBullets;

  for (const enemy of match.enemies.slice()) {
    for (const player of match.players.values()) {
      if (!player.alive || player.invulnerableMs > 0) {
        continue;
      }
      if (segmentPointDistanceSq(enemy.prevX, enemy.prevY, enemy.x, enemy.y, player.x, player.y) <= (enemy.radius + PLAYER_HITBOX_RADIUS) ** 2) {
        enemy.hp = 0;
        killEnemy(match, enemy.id);
        hitPlayer(match, player);
        break;
      }
    }
  }
  match.enemies = match.enemies.filter((enemy) => enemy.hp > 0);

  const remainingPickups: RuntimePickup[] = [];
  for (const pickup of match.pickups) {
    let collector: RuntimePlayer | undefined;
    for (const p of match.players.values()) {
      if (p.alive && distanceSq(p.x, p.y, pickup.x, pickup.y) <= PICKUP_COLLECT_RADIUS ** 2) {
        collector = p;
        break;
      }
    }
    if (!collector) {
      remainingPickups.push(pickup);
      continue;
    }
    if (pickup.kind === "weapon") {
      collector.weaponLevel = clamp(collector.weaponLevel + 1, 1, 3);
    } else if (pickup.kind === "bomb") {
      collector.bombs = clamp(collector.bombs + 1, 0, 3);
    } else if (pickup.kind === "shield") {
      collector.shieldMs = SHIELD_DURATION_MS;
    } else if (pickup.kind === "rapid_fire") {
      collector.rapidFireMs = RAPID_FIRE_DURATION_MS;
    } else if (pickup.kind === "laser") {
      collector.laserMs = LASER_DURATION_MS;
    }
    queueEvent(match, "pickup", `${collector.name} picked up ${pickup.kind}`);
  }
  match.pickups = remainingPickups;
};
