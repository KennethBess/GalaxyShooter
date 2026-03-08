import { GAME_WIDTH } from "../../../packages/shared/src/index.js";
import type {
  EnemyKind,
  GameEventMessage,
  GameMode,
  ShipId,
  ResultSummary,
  StageDef
} from "../../../packages/shared/src/index.js";
import { CAMPAIGN_STAGES } from "./stages.js";

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
}

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
