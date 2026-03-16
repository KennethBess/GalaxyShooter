## 1. Enemy Position Tracking

- [x] 1.1 Add `prevX` and `prevY` fields to `RuntimeEnemy` interface in `apps/server/src/gameTypes.ts`
- [x] 1.2 Initialize `prevX`/`prevY` to the enemy's spawn position in `createEnemy` in `apps/server/src/combat.ts`
- [x] 1.3 Update `prevX`/`prevY` at the start of `updateEnemies` in `apps/server/src/game.ts` (before velocity integration)

## 2. Swept Detection for Enemy Bullets

- [x] 2.1 Replace `distanceSq(bullet.x, bullet.y, player.x, player.y)` with `segmentPointDistanceSq(bullet.prevX, bullet.prevY, bullet.x, bullet.y, player.x, player.y)` in the enemy bullet → player collision check in `resolveCollisions`

## 3. Swept Detection for Enemy Body

- [x] 3.1 Replace `distanceSq(enemy.x, enemy.y, player.x, player.y)` with `segmentPointDistanceSq(enemy.prevX, enemy.prevY, enemy.x, enemy.y, player.x, player.y)` in the enemy body → player collision check in `resolveCollisions`

## 4. Tests

- [x] 4.1 Add test: enemy bullet edge-graze registers a hit via swept detection (bullet path passes near player but neither endpoint is within radius)
- [x] 4.2 Add test: enemy bullet clearly missing player does not register
- [x] 4.3 Add test: kamikaze edge-graze body collision registers via swept detection
- [x] 4.4 Add test: enemy `prevX`/`prevY` initialized correctly at spawn
- [x] 4.5 Verify all existing collision tests still pass

## 5. Verification

- [x] 5.1 Run `npm run lint` and fix any issues
- [x] 5.2 Run `npm run build` and verify clean compilation
