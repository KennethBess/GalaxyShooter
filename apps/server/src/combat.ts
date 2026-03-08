import { GAME_WIDTH, PLAYER_RESPAWN_MS } from "../../../packages/shared/src/index.js";
import type { EnemyKind } from "../../../packages/shared/src/index.js";
import { BOSS_PHASES, CAMPAIGN_STAGES } from "./stages.js";
import {
  clamp, distanceSq, getStage, getStageHotStartMs, LANES, nextId, queueEvent,
  type MatchRuntime, type RuntimeBullet, type RuntimeEnemy, type RuntimePickup, type RuntimePlayer
} from "./gameTypes.js";

export const createEnemy = (match: MatchRuntime, kind: EnemyKind, lane: number, waveId: string, boss = false): RuntimeEnemy => {
  if (boss) {
    return {
      id: nextId(match, "boss"),
      kind: "boss",
      x: GAME_WIDTH / 2,
      y: -120,
      vx: 90,
      vy: 40,
      hp: Math.round(420 * match.difficultyScale),
      maxHp: Math.round(420 * match.difficultyScale),
      radius: 56,
      fireCooldownMs: 1000,
      waveId,
      boss: true,
      phase: 0,
      entered: false
    };
  }

  const base =
    kind === "fighter"
      ? { hp: 12, speed: 130, radius: 20, cooldown: 1250 }
      : kind === "heavy"
        ? { hp: 28, speed: 70, radius: 28, cooldown: 1650 }
        : { hp: 10, speed: 220, radius: 18, cooldown: 999999 };

  return {
    id: nextId(match, "enemy"),
    kind,
    x: LANES[lane % LANES.length] ?? GAME_WIDTH / 2,
    y: -40,
    vx: kind === "kamikaze" ? 0 : ((lane % 2 === 0 ? 1 : -1) * 20),
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
    match.pickups.push({ id: nextId(match, "pickup"), kind: "bomb", x: enemy.x, y: enemy.y, vy: 110 });
    return;
  }
  if (match.idCounter % 5 === 0) {
    match.pickups.push({ id: nextId(match, "pickup"), kind: "weapon", x: enemy.x, y: enemy.y, vy: 120 });
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
      y: player.y - 18,
      vx: offset * 2.5,
      vy: -540,
      radius: 5,
      damage: player.weaponLevel >= 3 ? 12 : player.weaponLevel === 2 ? 10 : 9
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
        vx: 0,
        vy: 250 + Math.abs(offset) * 0.25,
        radius: 7,
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
    vx: 0,
    vy: enemy.kind === "heavy" ? 190 : 250,
    radius: enemy.kind === "heavy" ? 8 : 6,
    damage: 1
  });
  enemy.fireCooldownMs = enemy.kind === "heavy" ? 1500 : 1100;
};

export const hitPlayer = (match: MatchRuntime, player: RuntimePlayer) => {
  if (!player.alive || player.invulnerableMs > 0) {
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
      players: [...match.players.values()].map((current) => ({ playerId: current.playerId, name: current.name, shipId: current.shipId, score: current.score }))
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
  awardScore(match, ownerId, enemy.boss ? 1500 : enemy.kind === "heavy" ? 320 : 120);
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
          players: [...match.players.values()].map((current) => ({ playerId: current.playerId, name: current.name, shipId: current.shipId, score: current.score }))
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
      match.survivalBossMs = match.elapsedMs + 45000;
    }
  }
};

export const resolveCollisions = (match: MatchRuntime) => {
  const remainingBullets: RuntimeBullet[] = [];
  for (const bullet of match.bullets) {
    if (bullet.owner === "player") {
      let hit = false;
      for (const enemy of match.enemies) {
        if (distanceSq(bullet.x, bullet.y, enemy.x, enemy.y) <= (bullet.radius + enemy.radius) ** 2) {
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
      if (distanceSq(bullet.x, bullet.y, player.x, player.y) <= (bullet.radius + 16) ** 2) {
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

  for (const enemy of match.enemies) {
    for (const player of match.players.values()) {
      if (!player.alive || player.invulnerableMs > 0) {
        continue;
      }
      if (distanceSq(enemy.x, enemy.y, player.x, player.y) <= (enemy.radius + 16) ** 2) {
        enemy.hp = 0;
        hitPlayer(match, player);
      }
    }
  }
  match.enemies = match.enemies.filter((enemy) => enemy.hp > 0);

  const remainingPickups: RuntimePickup[] = [];
  for (const pickup of match.pickups) {
    const collector = [...match.players.values()].find((player) => player.alive && distanceSq(player.x, player.y, pickup.x, pickup.y) <= 28 ** 2);
    if (!collector) {
      remainingPickups.push(pickup);
      continue;
    }
    if (pickup.kind === "weapon") {
      collector.weaponLevel = clamp(collector.weaponLevel + 1, 1, 3);
    } else {
      collector.bombs = clamp(collector.bombs + 1, 0, 3);
    }
    queueEvent(match, "pickup", `${collector.name} picked up ${pickup.kind}`);
  }
  match.pickups = remainingPickups;
};
