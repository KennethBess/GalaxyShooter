import { ROOM_CODE_LENGTH } from "../../../packages/shared/src/index.js";
import type { MatchRuntime } from "./game.js";

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
}

export interface RoomRuntime {
  inputs: Map<string, InputState>;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  match?: MatchRuntime;
}

export const defaultInputState = (): InputState => ({ up: false, down: false, left: false, right: false, shoot: false });

export const normalizeRoomCode = (roomCode: string) =>
  roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);

export const createRoomRuntime = (playerIds: Iterable<string>): RoomRuntime => ({
  inputs: new Map(Array.from(playerIds, (playerId) => [playerId, defaultInputState()])),
  disconnectTimers: new Map()
});
