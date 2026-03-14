## 1. Shared Types

- [x] 1.1 Add `"shield"` and `"rapid_fire"` to the `PickupKind` union in `packages/shared/src/index.ts`
- [x] 1.2 Add `shieldActive: boolean` and `rapidFireActive: boolean` fields to the `SnapshotPlayer` interface in `packages/shared/src/index.ts`

## 2. Server — Runtime Types & Constants

- [x] 2.1 Add `shieldMs: number` and `rapidFireMs: number` fields to the `RuntimePlayer` interface in `apps/server/src/gameTypes.ts`
- [x] 2.2 Add `SHIELD_DURATION_MS` and `RAPID_FIRE_DURATION_MS` constants to `apps/server/src/gameTypes.ts`
- [x] 2.3 Initialize `shieldMs: 0` and `rapidFireMs: 0` in `createMatch` player factory inside `apps/server/src/game.ts`

## 3. Server — Effect Timers & Fire Rate

- [x] 3.1 In `updatePlayers` (`apps/server/src/game.ts`), decrement `player.shieldMs` and `player.rapidFireMs` by `deltaMs` each tick (clamp to 0)
- [x] 3.2 In `updatePlayers`, use `player.rapidFireMs > 0 ? PLAYER_FIRE_INTERVAL_MS / 2 : PLAYER_FIRE_INTERVAL_MS` as the shot cooldown reset value when firing

## 4. Server — Damage & Drop Logic

- [x] 4.1 In `hitPlayer` (`apps/server/src/combat.ts`), add an early-return guard: skip damage when `player.shieldMs > 0`
- [x] 4.2 In `maybeDropPickup` (`apps/server/src/combat.ts`), change the boss drop from `"bomb"` to `"shield"`
- [x] 4.3 In `maybeDropPickup`, change the 1-in-5 regular enemy drop from `"weapon"` to `"rapid_fire"`, and add a separate 1-in-7 roll for `"weapon"` drops

## 5. Server — Pickup Collection Effects

- [x] 5.1 In `resolveCollisions` (`apps/server/src/combat.ts`), add `shield` and `rapid_fire` cases to the pickup collection switch: set `collector.shieldMs = SHIELD_DURATION_MS` and `collector.rapidFireMs = RAPID_FIRE_DURATION_MS` respectively

## 6. Server — Snapshot Broadcast

- [x] 6.1 In the snapshot builder in `updateMatch` (`apps/server/src/game.ts`), include `shieldActive: player.shieldMs > 0` and `rapidFireActive: player.rapidFireMs > 0` in each `SnapshotPlayer` entry

## 7. Client — Pickup Sprite Rendering

- [x] 7.1 In `apps/client/src/phaser/game.ts`, add distinct visual representations (colored rectangles or sprites) for `shield` and `rapid_fire` pickup kinds when rendering `SnapshotState.pickups`

## 8. Client — HUD Effect Badges

- [x] 8.1 In `apps/client/src/app.ts` or `phaser/game.ts`, add HUD badge rendering that shows/hides a shield indicator based on the local player's `SnapshotPlayer.shieldActive`
- [x] 8.2 Add HUD badge rendering that shows/hides a rapid fire indicator based on the local player's `SnapshotPlayer.rapidFireActive`

## 9. Tests

- [x] 9.1 Add a test in `apps/server/test/combat.test.ts` verifying that a player with `shieldMs > 0` does not take damage from bullets
- [x] 9.2 Add a test verifying that `shieldMs` is set correctly when a `shield` pickup is collected
- [x] 9.3 Add a test verifying that `rapidFireMs` is set and the fire interval halved when a `rapid_fire` pickup is collected
- [x] 9.4 Run `npm test` and confirm all tests pass
