## Why

Players report bullets visually passing through enemies without registering hits. The server uses swept-segment collision detection (line-to-point distance), which is mathematically correct for stationary targets but has two gaps: (1) it treats enemies as stationary points during the swept check even though enemies also move each tick, and (2) enemy bullets use simple point-vs-circle checks with no swept detection, creating an asymmetric fidelity gap that affects gameplay fairness. Investigating and closing these gaps will make combat feel tighter and more reliable.

## What Changes

- Audit the collision pipeline order in `updateMatch` to confirm physics updates and collision checks are sequenced correctly
- Apply swept-segment detection to enemy-vs-player collision checks (currently only used for player bullets vs enemies)
- Add swept-circle detection for enemy movement against player hitbox (enemies currently teleport between positions with no interpolation check)
- Increase test coverage for high-speed edge cases (fast enemies, diagonal bullet paths, simultaneous multi-hit)
- Tune hitbox radii if investigation reveals visual-server mismatch on the client interpolation side

## Capabilities

### New Capabilities
- `enemy-collision-sweep`: Swept detection for enemy bullets against players and enemy body-vs-player checks, closing the fidelity gap with player bullet detection

### Modified Capabilities
- `bullet-hit-detection`: Extend swept-segment requirement to cover enemy bullets hitting players (currently spec only covers player bullets hitting enemies)

## Impact

- **Server:** `apps/server/src/combat.ts` (resolveCollisions), `apps/server/src/game.ts` (updateBullets, updateEnemies)
- **Shared:** `apps/server/src/gameTypes.ts` (enemy bullet types may need prevX/prevY tracking)
- **Tests:** `apps/server/test/combat.test.ts` (new scenarios for enemy swept detection)
- **Client:** No changes expected — fix is purely server-side physics
