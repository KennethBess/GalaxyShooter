import type {
  EnemyKind,
  GameEventMessage,
  GameMode,
  InputState,
  ResultSummary,
  ShipId,
  StageDef
} from "../../../packages/shared/src/index.js";
import {
  GAME_WIDTH,
  PLAYER_CLAMP_X_MAX_OFFSET,
  PLAYER_CLAMP_X_MIN,
  PLAYER_CLAMP_Y_MAX_OFFSET,
  PLAYER_CLAMP_Y_MIN
} from "../../../packages/shared/src/index.js";
import { CAMPAIGN_STAGES } from "./stages.js";

export type { InputState };

export interface RuntimePlayer {
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

export interface RuntimeEnemy {
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

export interface RuntimeBullet {
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

export interface RuntimePickup {
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

export const LANES = [150, 350, 520, 760, 930, 1130];

// --- Enemy stat baselines ---
export const BOSS_HP_BASE = 420;
export const BOSS_RADIUS = 56;
export const BOSS_INITIAL_VX = 90;
export const BOSS_INITIAL_VY = 40;
export const BOSS_FIRE_COOLDOWN_MS = 1000;
export const BOSS_SPAWN_Y = -120;
export const BOSS_ENTER_Y = 110;
export const BOSS_WALL_MARGIN = 140;

export const FIGHTER_STATS = { hp: 12, speed: 130, radius: 20, cooldown: 1250 } as const;
export const HEAVY_STATS = { hp: 28, speed: 70, radius: 28, cooldown: 1650 } as const;
export const KAMIKAZE_STATS = { hp: 10, speed: 220, radius: 18, cooldown: 999999 } as const;

export const ENEMY_SPAWN_Y = -40;
export const ENEMY_DRIFT_SPEED = 20;

// --- Scoring ---
export const SCORE_BOSS = 1500;
export const SCORE_HEAVY = 320;
export const SCORE_FIGHTER = 120;

// --- Player bullet stats ---
export const PLAYER_BULLET_SPEED = -540;
export const PLAYER_BULLET_RADIUS = 5;
export const PLAYER_BULLET_OFFSET_Y = -18;
export const PLAYER_BULLET_DAMAGE = { level1: 9, level2: 10, level3: 12 } as const;

// --- Enemy bullet stats ---
export const ENEMY_BULLET_SPEED_BASE = 250;
export const ENEMY_BULLET_RADIUS_SMALL = 6;
export const ENEMY_BULLET_RADIUS_LARGE = 8;
export const ENEMY_BULLET_SPEED_HEAVY = 190;
export const HEAVY_FIRE_COOLDOWN_MS = 1500;
export const FIGHTER_FIRE_COOLDOWN_MS = 1100;

// --- Pickup ---
export const PICKUP_DROP_SPEED = 120;
export const PICKUP_BOSS_DROP_SPEED = 110;
export const PICKUP_COLLECT_RADIUS = 28;

// --- Gameplay constants ---
export const PLAYER_HITBOX_RADIUS = 16;
export const INVULNERABLE_AFTER_RESPAWN_MS = 1200;
export const PLAYER_SPAWN_Y_OFFSET = 110;
export const PLAYER_SPAWN_SPACING = 70;
export { PLAYER_CLAMP_X_MIN, PLAYER_CLAMP_X_MAX_OFFSET, PLAYER_CLAMP_Y_MIN, PLAYER_CLAMP_Y_MAX_OFFSET };
export const BOMB_DAMAGE_BOSS = 35;
export const BOMB_DAMAGE_NORMAL = 999;
export const KAMIKAZE_MIN_VY = 180;

// --- Survival mode ---
export const SURVIVAL_SPAWN_BASE_MS = 2200;
export const SURVIVAL_SPAWN_REDUCTION_PER_STAGE = 130;
export const SURVIVAL_SPAWN_MIN_MS = 750;
export const SURVIVAL_BOSS_INTERVAL_MS = 45000;
export const SURVIVAL_INITIAL_SPAWN_MS = 1500;
export const SURVIVAL_INITIAL_BOSS_MS = 35000;
export const SURVIVAL_STAGE_DURATION_MS = 30000;

// --- Difficulty ---
export const DIFFICULTY_EXTRA_PER_PLAYER = 0.45;
export const WAVE_EXTRA_SCALE = 1.6;
export const WAVE_SPACING_Y = 28;

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const distanceSq = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

export const nextId = (match: MatchRuntime, prefix: string) => {
  match.idCounter += 1;
  return `${prefix}-${match.idCounter}`;
};

export const getStage = (match: MatchRuntime): StageDef => CAMPAIGN_STAGES[clamp(match.stageIndex, 0, CAMPAIGN_STAGES.length - 1)]!;

export const getStageHotStartMs = (stage: StageDef) => Math.max(0, (stage.waves[0]?.timeMs ?? 0) - 250);

export const queueEvent = (match: MatchRuntime, kind: GameEventMessage["payload"]["kind"], text: string) => {
  match.pendingEvents.push({ type: "game_event", payload: { kind, text } });
};
