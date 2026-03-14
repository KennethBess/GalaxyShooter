## Why

Player bullets are checked for collision using their center position at the end of each tick, not along the path they traveled during the tick. At 540 px/s (18 px/tick at 30 Hz), fast-moving bullets can visually graze an enemy's edge and pass cleanly through without registering a hit, because the bullet's start and end positions for that tick are both outside the enemy's hitbox circle even though the bullet's actual path passed through it.

## What Changes

- `RuntimeBullet` gains `prevX` and `prevY` fields to record position at the start of each tick.
- `updateBullets` in `game.ts` saves the bullet's current position into `prevX`/`prevY` before updating its position each tick.
- `resolveCollisions` in `combat.ts` replaces the point-vs-circle check with a segment-vs-circle check: the minimum distance from the line segment `(prevX, prevY) → (x, y)` to the enemy center must be ≤ `bullet.radius + enemy.radius`.
- `PLAYER_BULLET_RADIUS` increases from `5` to `8` to better match the visual bullet width rendered on the client (currently the 5 px physics radius is noticeably narrower than the rendered circle).
- A `segmentPointDistanceSq` helper is added to `gameTypes.ts`.

## Capabilities

### New Capabilities

- `bullet-hit-detection`: Correct segment-sweep collision detection for player bullets against enemies, preventing edge misses due to discrete tick sampling.

### Modified Capabilities

_(none — no existing spec-level requirement is changing, only the implementation correctness)_

## Impact

- **Server:** `apps/server/src/gameTypes.ts` (new constant + helper), `apps/server/src/game.ts` (`updateBullets`), `apps/server/src/combat.ts` (`resolveCollisions`).
- **Shared:** `PLAYER_BULLET_RADIUS` change propagates to client predicted-shot rendering (visual only, no gameplay breakage).
- **Tests:** Existing combat tests unaffected; one new test added for edge-grazing scenario.
- No breaking changes to message protocol or room lifecycle.
