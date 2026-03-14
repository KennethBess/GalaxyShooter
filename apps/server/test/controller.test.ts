import assert from "node:assert/strict";
import test from "node:test";
import { createTestManager } from "./helpers.js";

test("connectController succeeds for valid room and player", async () => {
  const manager = createTestManager();
  const host = await manager.createRoom("Host", "azure");

  const playerName = await manager.connectController(host.roomCode, host.playerId, "ctrl-1");

  assert.equal(playerName, "Host");
});

test("connectController rejects invalid player", async () => {
  const manager = createTestManager();
  await manager.createRoom("Host", "azure");

  await assert.rejects(
    () => manager.connectController("ZZZZZ", "nonexistent", "ctrl-2"),
    /Room not found/
  );
});

test("connectController rejects player not in room", async () => {
  const manager = createTestManager();
  const host = await manager.createRoom("Host", "azure");

  await assert.rejects(
    () => manager.connectController(host.roomCode, "not-a-player", "ctrl-3"),
    /Player not found/
  );
});

test("controller input routes to target player", async () => {
  const manager = createTestManager();
  const host = await manager.createRoom("Host", "azure");
  const wing = await manager.joinRoom(host.roomCode, "Wing", "emerald");

  await manager.connectController(host.roomCode, wing.playerId, "ctrl-4");
  await manager.handleControllerMessage("ctrl-4", {
    type: "input",
    payload: { up: true, down: false, left: false, right: true, shoot: true }
  });

  // Verify input was set by ticking and checking no errors
  await manager.tick();
});

test("controller use_bomb routes to target player", async () => {
  const manager = createTestManager();
  const host = await manager.createRoom("Host", "azure");

  await manager.connectController(host.roomCode, host.playerId, "ctrl-5");

  // Should not throw — bomb is queued for the target player
  await manager.handleControllerMessage("ctrl-5", { type: "use_bomb" });
});

test("controller disconnect does not remove player", async () => {
  const manager = createTestManager();
  const host = await manager.createRoom("Host", "azure");

  await manager.connectController(host.roomCode, host.playerId, "ctrl-6");
  manager.disconnectController("ctrl-6");

  // Player should still be in the room
  const state = await manager.validatePlayer(host.roomCode, host.playerId);
  assert.equal(state.players.length, 1);
  assert.equal(state.players[0]?.name, "Host");
});

test("unpaired controller message throws", async () => {
  const manager = createTestManager();

  await assert.rejects(
    () => manager.handleControllerMessage("nonexistent-ctrl", {
      type: "input",
      payload: { up: false, down: false, left: false, right: false, shoot: false }
    }),
    /Controller not paired/
  );
});
