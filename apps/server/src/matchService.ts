import type { RoomState, ServerMessage } from "../../../packages/shared/src/index.js";
import { createMatch, queueBomb, updateMatch } from "./game.js";
import { defaultInputState, type RoomRuntime } from "./runtime.js";

export class MatchService {
  start(state: RoomState, runtime: RoomRuntime): ServerMessage[] {
    if (state.status !== "waiting") {
      throw new Error("Room is not available for starting");
    }
    if (state.players.length === 0) {
      throw new Error("Room has no players");
    }
    const nonHostsReady = state.players
      .filter((candidate) => !candidate.isHost)
      .every((candidate) => candidate.ready || !candidate.connected);

    if (!nonHostsReady) {
      throw new Error("All connected non-host players must be ready");
    }

    runtime.match = createMatch(state.roomCode, state.mode, state.players);
    state.status = "in_match";
    state.teamLives = runtime.match.teamLives;
    state.updatedAt = Date.now();
    const { snapshot } = updateMatch(runtime.match, runtime.inputs, 0);

    return [
      { type: "room_state", payload: state },
      { type: "match_started", payload: { mode: state.mode, stageLabel: runtime.match.stageLabel } },
      { type: "snapshot", payload: snapshot }
    ];
  }

  queueBomb(runtime: RoomRuntime, playerId: string) {
    if (runtime.match) {
      queueBomb(runtime.match, playerId);
    }
  }

  removePlayer(runtime: RoomRuntime, playerId: string) {
    runtime.match?.players.delete(playerId);
  }

  tick(state: RoomState, runtime: RoomRuntime, deltaMs: number): ServerMessage[] {
    if (!runtime.match || state.status !== "in_match") {
      return [];
    }

    const { snapshot, events, result } = updateMatch(runtime.match, runtime.inputs, deltaMs);
    state.teamLives = snapshot.teamLives;
    for (const player of state.players) {
      const runtimePlayer = runtime.match.players.get(player.playerId);
      if (runtimePlayer) {
        player.score = runtimePlayer.score;
      }
    }

    const messages: ServerMessage[] = [{ type: "snapshot", payload: snapshot }, ...events];
    if (result) {
      state.status = "waiting";
      state.teamLives = 0;
      runtime.match = undefined;
      for (const player of state.players) {
        player.ready = player.isHost;
        player.score = 0;
        player.livesLost = 0;
      }
      for (const playerId of runtime.inputs.keys()) {
        runtime.inputs.set(playerId, defaultInputState());
      }
      state.updatedAt = Date.now();
      messages.push({ type: "match_result", payload: result });
      messages.push({ type: "room_state", payload: state });
    }
    return messages;
  }
}

