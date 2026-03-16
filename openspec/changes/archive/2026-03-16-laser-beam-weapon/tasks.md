## 1. Shared Types & Constants

- [x] 1.1 Add `"laser"` to the `PickupKind` union type in `packages/shared/src/index.ts`
- [x] 1.2 Add `laserActive: boolean` field to the `SnapshotPlayer` interface in `packages/shared/src/index.ts`

## 2. Server Runtime Types & Constants

- [x] 2.1 Add `laserMs: number` field to `RuntimePlayer` in `apps/server/src/gameTypes.ts`
- [x] 2.2 Add constants `LASER_DURATION_MS` (6000), `LASER_BEAM_HALF_WIDTH` (12), and `LASER_DAMAGE_PER_TICK` (3) to `apps/server/src/gameTypes.ts`
- [x] 2.3 Initialize `laserMs: 0` in player creation within `apps/server/src/game.ts`

## 3. Server Pickup & Collection

- [x] 3.1 Add laser pickup drop logic to `maybeDropPickup` in `apps/server/src/combat.ts` using `idCounter % 11 === 0` cadence
- [x] 3.2 Add `"laser"` case to pickup collection in `resolveCollisions` — set `player.laserMs = LASER_DURATION_MS`

## 4. Server Laser Beam Logic

- [x] 4.1 Implement `resolveLaserBeam(player, enemies)` function in `apps/server/src/combat.ts` — rectangle-circle intersection check, apply `LASER_DAMAGE_PER_TICK` to each intersecting enemy
- [x] 4.2 Add laser timer countdown in the player update loop (`apps/server/src/game.ts`) — decrement `laserMs` by `deltaMs`, clamp to 0
- [x] 4.3 Gate `spawnPlayerVolley` behind `laserMs === 0` check in the game loop to suppress bullets during laser mode
- [x] 4.4 Call `resolveLaserBeam` for each player with `laserMs > 0 && input.shoot` during the collision resolution phase

## 5. Server Snapshot

- [x] 5.1 Add `laserActive: laserMs > 0` to the `SnapshotPlayer` serialization in the snapshot builder

## 6. Client Rendering

- [x] 6.1 Add laser pickup rendering (e.g., "L" in red/orange text) to `syncPickups` in `apps/client/src/phaser/game.ts`
- [x] 6.2 Render laser beam visual (semi-transparent vertical rectangle from player to top of screen) in `syncBullets` or a new `syncLasers` function when `player.laserActive` is true
- [x] 6.3 Add "LASER" HUD badge to the active effects display, styled consistently with existing shield and rapid fire badges

## 7. Tests

- [x] 7.1 Add test: laser pickup collection sets `laserMs` to `LASER_DURATION_MS`
- [x] 7.2 Add test: beam damages enemy whose circle intersects the beam rectangle
- [x] 7.3 Add test: beam does not damage enemy outside beam width
- [x] 7.4 Add test: beam pierces through multiple enemies (all take damage in same tick)
- [x] 7.5 Add test: no bullets spawned while `laserMs > 0`
- [x] 7.6 Add test: normal fire resumes after `laserMs` expires
