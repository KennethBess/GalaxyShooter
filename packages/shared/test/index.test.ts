import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_SHIP_ID,
  GAME_HEIGHT,
  GAME_WIDTH,
  isShipId,
  MAX_PLAYERS,
  PLAYER_FIRE_INTERVAL_MS,
  PLAYER_RESPAWN_MS,
  PLAYER_SPEED,
  RECONNECT_GRACE_MS,
  ROOM_CODE_LENGTH,
  SHIP_IDS,
  SHIP_OPTIONS,
  TEAM_LIVES_BASE,
  TICK_RATE,
} from "../src/index.js";

describe("isShipId", () => {
  it("returns true for valid ship IDs", () => {
    assert.equal(isShipId("azure"), true);
    assert.equal(isShipId("crimson"), true);
    assert.equal(isShipId("emerald"), true);
  });

  it("returns false for invalid values", () => {
    assert.equal(isShipId("invalid"), false);
    assert.equal(isShipId(""), false);
    assert.equal(isShipId("AZURE"), false);
    assert.equal(isShipId("blue"), false);
  });
});

describe("constants", () => {
  it("has expected game dimensions", () => {
    assert.equal(GAME_WIDTH, 1280);
    assert.equal(GAME_HEIGHT, 720);
  });

  it("has expected player limits", () => {
    assert.equal(MAX_PLAYERS, 4);
  });

  it("has expected tick rate", () => {
    assert.equal(TICK_RATE, 30);
  });

  it("has expected player constants", () => {
    assert.equal(PLAYER_SPEED, 420);
    assert.equal(PLAYER_FIRE_INTERVAL_MS, 170);
    assert.equal(PLAYER_RESPAWN_MS, 1600);
  });

  it("has expected team lives base", () => {
    assert.equal(TEAM_LIVES_BASE, 6);
  });

  it("has expected reconnect grace period", () => {
    assert.equal(RECONNECT_GRACE_MS, 15000);
  });

  it("ROOM_CODE_LENGTH is 5", () => {
    assert.equal(ROOM_CODE_LENGTH, 5);
  });
});

describe("SHIP_OPTIONS", () => {
  it("has 3 entries", () => {
    assert.equal(SHIP_OPTIONS.length, 3);
  });

  it("entries match SHIP_IDS", () => {
    const ids = SHIP_OPTIONS.map((opt) => opt.id);
    assert.deepEqual(ids, [...SHIP_IDS]);
  });
});

describe("DEFAULT_SHIP_ID", () => {
  it('is "azure"', () => {
    assert.equal(DEFAULT_SHIP_ID, "azure");
  });
});
