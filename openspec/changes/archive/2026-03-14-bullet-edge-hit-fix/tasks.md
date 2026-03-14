## 1. Shared Types & Constants

- [x] 1.1 Change `PLAYER_BULLET_RADIUS` from `5` to `8` in `apps/server/src/gameTypes.ts`
- [x] 1.2 Add `segmentPointDistanceSq(ax, ay, bx, by, px, py): number` helper to `apps/server/src/gameTypes.ts` using clamped projection (guard for zero-length segment)
- [x] 1.3 Add `prevX: number` and `prevY: number` fields to the `RuntimeBullet` interface in `apps/server/src/gameTypes.ts`

## 2. Bullet Spawn Sites

- [x] 2.1 In `spawnPlayerVolley` (`apps/server/src/combat.ts`), add `prevX: player.x + offset, prevY: player.y + PLAYER_BULLET_OFFSET_Y` to each bullet literal
- [x] 2.2 In `fireEnemy` (`apps/server/src/combat.ts`), add `prevX: <initial x>, prevY: <initial y>` to each enemy bullet literal (boss volley bullets and regular enemy bullets)

## 3. Bullet Position Tracking

- [x] 3.1 In `updateBullets` (`apps/server/src/game.ts`), before integrating velocity, set `bullet.prevX = bullet.x` and `bullet.prevY = bullet.y` for each bullet

## 4. Collision Detection

- [x] 4.1 In `resolveCollisions` (`apps/server/src/combat.ts`), replace the `distanceSq(bullet.x, bullet.y, enemy.x, enemy.y) <= (bullet.radius + enemy.radius) ** 2` check with `segmentPointDistanceSq(bullet.prevX, bullet.prevY, bullet.x, bullet.y, enemy.x, enemy.y) <= (bullet.radius + enemy.radius) ** 2`
- [x] 4.2 Import `segmentPointDistanceSq` in `combat.ts`

## 5. Tests

- [x] 5.1 Add a test in `apps/server/test/combat.test.ts` that verifies an edge-grazing bullet (whose start and end positions are both outside the enemy hitbox but whose path crosses it) registers a hit after the fix
- [x] 5.2 Run `npm test` and confirm all tests pass
