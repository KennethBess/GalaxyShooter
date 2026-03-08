import { GAME_HEIGHT, GAME_WIDTH, PLAYER_FIRE_INTERVAL_MS, PLAYER_RESPAWN_MS, PLAYER_SPEED, TEAM_LIVES_BASE } from "../../../packages/shared/src/index.js";
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

interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
}

interface RuntimePlayer {
  playerId: string;
  name: string;
  shipId: ShipId;
  x: number;
  y: number;
  alive: boolean;
  bombs: number;
  weaponLevel: number;
  score: number;
  shotCooldownMs: number;
  respawnMs: number;
  invulnerableMs: number;
  pendingBomb: boolean;
}

interface RuntimeEnemy {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  fireCooldownMs: number;
  waveId: string;
  boss: boolean;
  phase: number;
  entered: boolean;
}

interface RuntimeBullet {
  id: string;
  owner: "player" | "enemy";
  ownerId?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
}

interface RuntimePickup {
  id: string;
  kind: "weapon" | "bomb";
  x: number;
  y: number;
  vy: number;
}

export interface MatchRuntime {
  roomCode: string;
  mode: GameMode;
  tick: number;
  elapsedMs: number;
  teamLives: number;
  stageIndex: number;
  stageElapsedMs: number;
  stageLabel: string;
  stageBossSpawned: boolean;
  spawnedWaves: Set<string>;
  players: Map<string, RuntimePlayer>;
  enemies: RuntimeEnemy[];
  bullets: RuntimeBullet[];
  pickups: RuntimePickup[];
  pendingEvents: GameEventMessage[];
  result?: ResultSummary;
  idCounter: number;
  survivalSpawnMs: number;
  survivalBossMs: number;
  difficultyScale: number;
  stageTransitionPending: boolean;
}

const LANES = [150, 350, 520, 760, 930, 1130];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distanceSq = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

const nextId = (match: MatchRuntime, prefix: string) => {
  match.idCounter += 1;
  return `${prefix}-${match.idCounter}`;
};

const getStage = (match: MatchRuntime): StageDef => CAMPAIGN_STAGES[clamp(match.stageIndex, 0, CAMPAIGN_STAGES.length - 1)]!;
const getStageHotStartMs = (stage: StageDef) => Math.max(0, (stage.waves[0]?.timeMs ?? 0) - 250);

const queueEvent = (match: MatchRuntime, kind: GameEventMessage["payload"]["kind"], text: string) => {
  match.pendingEvents.push({ type: "game_event", payload: { kind, text } });
};

const createEnemy = (match: MatchRuntime, kind: EnemyKind, lane: number, waveId: string, boss = false): RuntimeEnemy => {
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

const awardScore = (match: MatchRuntime, playerId: string | undefined, points: number) => {
  if (!playerId) {
    return;
  }
  const player = match.players.get(playerId);
  if (player) {
    player.score += points;
  }
};

const maybeDropPickup = (match: MatchRuntime, enemy: RuntimeEnemy) => {
  if (enemy.boss) {
    match.pickups.push({ id: nextId(match, "pickup"), kind: "bomb", x: enemy.x, y: enemy.y, vy: 110 });
    return;
  }
  if (match.idCounter % 5 === 0) {
    match.pickups.push({ id: nextId(match, "pickup"), kind: "weapon", x: enemy.x, y: enemy.y, vy: 120 });
  }
};

const spawnPlayerVolley = (match: MatchRuntime, player: RuntimePlayer) => {
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

const fireEnemy = (match: MatchRuntime, enemy: RuntimeEnemy) => {
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

const hitPlayer = (match: MatchRuntime, player: RuntimePlayer) => {
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

const killEnemy = (match: MatchRuntime, enemyId: string, ownerId?: string) => {
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

const processWaves = (match: MatchRuntime) => {
  if (match.mode === "campaign") {
    const stage = getStage(match);
    for (const wave of stage.waves) {
      if (match.spawnedWaves.has(wave.id) || match.stageElapsedMs < wave.timeMs) {
        continue;
      }
      match.spawnedWaves.add(wave.id);
      const count = wave.count + Math.floor((match.difficultyScale - 1) * 1.6);
      for (let index = 0; index < count; index += 1) {
        const enemy = createEnemy(match, wave.kind, wave.lane + index, wave.id);
        enemy.y -= index * 28;
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
    match.survivalSpawnMs = match.elapsedMs + clamp(2200 - match.stageIndex * 130, 750, 2200);
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
    match.survivalBossMs = match.elapsedMs + 45000;
  }
};

const updatePlayers = (match: MatchRuntime, inputs: Map<string, InputState>, deltaMs: number) => {
  for (const player of match.players.values()) {
    if (player.respawnMs > 0) {
      player.respawnMs -= deltaMs;
      if (player.respawnMs <= 0) {
        player.alive = true;
        player.invulnerableMs = 1200;
        player.x = GAME_WIDTH / 2;
        player.y = GAME_HEIGHT - 110;
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
    player.x = clamp(player.x + ((dx / length) * PLAYER_SPEED * deltaMs) / 1000, 40, GAME_WIDTH - 40);
    player.y = clamp(player.y + ((dy / length) * PLAYER_SPEED * deltaMs) / 1000, 80, GAME_HEIGHT - 40);

    if (player.pendingBomb && player.bombs > 0) {
      player.pendingBomb = false;
      player.bombs -= 1;
      match.bullets = match.bullets.filter((bullet) => bullet.owner !== "enemy");
      for (const enemy of match.enemies) {
        enemy.hp -= enemy.boss ? 35 : 999;
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
      enemy.entered = enemy.entered || enemy.y >= 110;
      enemy.y = enemy.entered ? enemy.y : enemy.y + (enemy.vy * deltaMs) / 1000;
      enemy.x += (enemy.vx * deltaMs) / 1000;
      if (enemy.x < 140 || enemy.x > GAME_WIDTH - 140) {
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
          enemy.vx = (dx / length) * 220;
          enemy.vy = Math.max(180, (dy / length) * 220);
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

const resolveCollisions = (match: MatchRuntime) => {
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

export const createMatch = (roomCode: string, mode: GameMode, players: PlayerSlot[]): MatchRuntime => {
  const runtimePlayers = new Map<string, RuntimePlayer>();
  players.forEach((player, index) => {
    runtimePlayers.set(player.playerId, {
      playerId: player.playerId,
      name: player.name,
      shipId: player.shipId,
      x: GAME_WIDTH / 2 + (index - (players.length - 1) / 2) * 70,
      y: GAME_HEIGHT - 110,
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
    survivalSpawnMs: 1500,
    survivalBossMs: 35000,
    difficultyScale: 1 + (players.length - 1) * 0.45,
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
      match.stageIndex = Math.max(1, Math.floor(match.elapsedMs / 30000) + 1);
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









