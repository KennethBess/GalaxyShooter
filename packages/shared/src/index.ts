export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const MAX_PLAYERS = 4;
export const TICK_RATE = 30;
export const PLAYER_SPEED = 420;
export const PLAYER_FIRE_INTERVAL_MS = 170;
export const PLAYER_RESPAWN_MS = 1600;
export const TEAM_LIVES_BASE = 6;
export const RECONNECT_GRACE_MS = 15000;
export const ROOM_CODE_LENGTH = 5;

// Movement clamp bounds (shared between client and server)
export const PLAYER_CLAMP_X_MIN = 40;
export const PLAYER_CLAMP_X_MAX_OFFSET = 40;
export const PLAYER_CLAMP_Y_MIN = 80;
export const PLAYER_CLAMP_Y_MAX_OFFSET = 40;

// Client interpolation constants
export const DRIFT_SNAP_THRESHOLD = 220;
export const DRIFT_LERP_THRESHOLD = 96;
export const LERP_SPEED_FACTOR = 18;
export const LERP_FACTOR_MIN = 0.18;
export const LERP_FACTOR_MAX = 0.42;

export const SHIP_IDS = ["azure", "crimson", "emerald"] as const;
export type ShipId = (typeof SHIP_IDS)[number];
export const DEFAULT_SHIP_ID: ShipId = "azure";

export interface ShipOption {
  id: ShipId;
  label: string;
  primary: string;
  trim: string;
  glow: string;
  dark: string;
}

export const SHIP_OPTIONS: ShipOption[] = [
  { id: "azure", label: "Azure", primary: "#62b8ff", trim: "#dcefff", glow: "#ffae4d", dark: "#1d3d65" },
  { id: "crimson", label: "Crimson", primary: "#ff6885", trim: "#ffe1e8", glow: "#ffad52", dark: "#612039" },
  { id: "emerald", label: "Emerald", primary: "#56d6a0", trim: "#e0fff2", glow: "#ffbf61", dark: "#175241" }
];

export const isShipId = (value: string): value is ShipId => SHIP_IDS.includes(value as ShipId);

export type GameMode = "campaign" | "survival";
export type RoomStatus = "waiting" | "starting" | "in_match" | "results" | "closed";
export type MatchOutcome = "victory" | "defeat";
export type EnemyKind = "fighter" | "heavy" | "kamikaze" | "boss";
export type PickupKind = "weapon" | "bomb";

export interface PlayerSlot {
  playerId: string;
  name: string;
  shipId: ShipId;
  isHost: boolean;
  connected: boolean;
  ready: boolean;
  score: number;
  livesLost: number;
  joinedAt: number;
}

export interface RoomState {
  roomCode: string;
  status: RoomStatus;
  mode: GameMode;
  maxPlayers: number;
  hostPlayerId: string;
  players: PlayerSlot[];
  teamLives: number;
  createdAt: number;
  updatedAt: number;
}

export interface RoomSummary {
  roomCode: string;
  playerId: string;
  room: RoomState;
}

export interface OpenRoomSummary {
  roomCode: string;
  mode: GameMode;
  status: RoomStatus;
  playerCount: number;
  maxPlayers: number;
  hostName: string;
  createdAt: number;
  updatedAt: number;
}

export interface SnapshotPlayer {
  playerId: string;
  name: string;
  shipId: ShipId;
  x: number;
  y: number;
  alive: boolean;
  bombs: number;
  weaponLevel: number;
  score: number;
}

export interface SnapshotEnemy {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  phase?: number;
}

export interface SnapshotBullet {
  id: string;
  owner: "player" | "enemy";
  x: number;
  y: number;
  radius: number;
}

export interface SnapshotPickup {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
}

export interface SnapshotState {
  tick: number;
  roomCode: string;
  mode: GameMode;
  stageIndex: number;
  stageLabel: string;
  elapsedMs: number;
  teamLives: number;
  score: number;
  players: SnapshotPlayer[];
  enemies: SnapshotEnemy[];
  bullets: SnapshotBullet[];
  pickups: SnapshotPickup[];
}

export interface ResultPlayerSummary {
  playerId: string;
  name: string;
  shipId: ShipId;
  score: number;
}

export interface ResultSummary {
  outcome: MatchOutcome;
  mode: GameMode;
  score: number;
  stageReached: number;
  durationMs: number;
  players: ResultPlayerSummary[];
}

export interface StageDef {
  id: string;
  label: string;
  durationMs: number;
  bossId: string;
  waves: EnemySpawnDef[];
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
}

export interface EnemySpawnDef {
  id: string;
  timeMs: number;
  kind: EnemyKind;
  lane: number;
  count: number;
  spacingMs: number;
}

export interface BossPhaseDef {
  threshold: number;
  fireIntervalMs: number;
}

export interface MatchConfig {
  mode: GameMode;
  difficultyScale: number;
  teamLives: number;
}

export interface CreateRoomRequest {
  playerName: string;
  shipId: ShipId;
}

export interface JoinRoomRequest {
  playerName: string;
  shipId: ShipId;
}

export interface RealtimeNegotiationRequest {
  roomCode: string;
  playerId: string;
}

export interface DirectRealtimeNegotiation {
  mode: "direct";
  url: string;
}

export interface WebPubSubRealtimeNegotiation {
  mode: "webpubsub";
  hub: string;
  url: string;
  protocol: "json.webpubsub.azure.v1";
}

export type RealtimeNegotiationResponse = DirectRealtimeNegotiation | WebPubSubRealtimeNegotiation;

export interface ErrorPayload {
  message: string;
}

export interface PlayerInputMessage {
  type: "input";
  payload: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    shoot: boolean;
  };
}

export interface ReadyMessage {
  type: "ready";
  payload: {
    ready: boolean;
  };
}

export interface SetModeMessage {
  type: "set_mode";
  payload: {
    mode: GameMode;
  };
}

export interface StartMatchMessage {
  type: "start_match";
}

export interface UseBombMessage {
  type: "use_bomb";
}

export interface LeaveRoomMessage {
  type: "leave_room";
}

export interface ReconnectMessage {
  type: "reconnect";
  payload: {
    playerId: string;
  };
}

export interface PingMessage {
  type: "ping";
}

export type ClientMessage =
  | PlayerInputMessage
  | ReadyMessage
  | SetModeMessage
  | StartMatchMessage
  | UseBombMessage
  | LeaveRoomMessage
  | ReconnectMessage
  | PingMessage;

export interface RoomStateMessage {
  type: "room_state";
  payload: RoomState;
}

export interface PlayerJoinedMessage {
  type: "player_joined";
  payload: {
    player: PlayerSlot;
  };
}

export interface PlayerLeftMessage {
  type: "player_left";
  payload: {
    playerId: string;
  };
}

export interface MatchStartedMessage {
  type: "match_started";
  payload: {
    mode: GameMode;
    stageLabel: string;
  };
}

export interface SnapshotMessage {
  type: "snapshot";
  payload: SnapshotState;
}

export interface GameEventMessage {
  type: "game_event";
  payload: {
    kind: "player_hit" | "player_respawn" | "boss_phase" | "boss_defeated" | "stage_clear" | "pickup";
    text: string;
  };
}

export interface MatchResultMessage {
  type: "match_result";
  payload: ResultSummary;
}

export interface ErrorMessage {
  type: "error";
  payload: ErrorPayload;
}

export type ServerMessage =
  | RoomStateMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | MatchStartedMessage
  | SnapshotMessage
  | GameEventMessage
  | MatchResultMessage
  | ErrorMessage;

