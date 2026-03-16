## Context

The collision pipeline in `resolveCollisions` (combat.ts) uses two different detection methods:

1. **Player bullets vs enemies** — swept-segment detection via `segmentPointDistanceSq`. Checks the minimum distance from the bullet's travel path (prevPos → currentPos) to the enemy center. This is robust against tunneling.
2. **Enemy bullets vs players** — simple point-vs-circle via `distanceSq`. Only checks the bullet's current position against the player hitbox. No swept detection.
3. **Enemy body vs player** — same simple `distanceSq`. Only checks current positions.

At 30 Hz tick rate:
- Player bullets move 18 px/frame (540 px/s) — swept detection handles this well
- Enemy bullets move 8.3 px/frame (250 px/s base) — less likely to tunnel, but still possible at edges of a 32-pixel-diameter player hitbox
- Kamikazes move 7.3 px/frame (220 px/s) — similar risk profile

The enemy bullets already track `prevX`/`prevY` (set in `updateBullets`), so the swept detection infrastructure is already in place — it's just not being used for the enemy bullet → player check.

## Goals / Non-Goals

**Goals:**
- Apply swept-segment detection to enemy bullet → player collision checks
- Apply swept-segment detection to enemy body → player collision checks (kamikazes especially)
- Add test coverage for enemy-side swept collision scenarios
- Keep collision performance O(n·m) — no spatial partitioning needed at current entity counts

**Non-Goals:**
- Adding spatial partitioning (quadtree, grid) — entity counts are low (~50 enemies, ~20 bullets max)
- Changing player bullet detection (already uses swept detection)
- Modifying hitbox radii or bullet speeds
- Client-side rendering changes

## Decisions

### 1. Reuse `segmentPointDistanceSq` for enemy bullet → player checks

**Decision:** Replace the `distanceSq(bullet.x, bullet.y, player.x, player.y)` call on line 238 of combat.ts with `segmentPointDistanceSq(bullet.prevX, bullet.prevY, bullet.x, bullet.y, player.x, player.y)`.

**Rationale:** Enemy bullets already store `prevX`/`prevY` (updated in `updateBullets`). The function is already imported. This is a one-line change with zero new infrastructure.

**Alternative considered:** Decreasing tick interval to 60 Hz — rejected because it doubles server CPU cost for all rooms and the swept approach solves the problem directly.

### 2. Track previous position for enemies and use swept detection for body collisions

**Decision:** Add `prevX`/`prevY` fields to `RuntimeEnemy`, update them at the start of `updateEnemies`, and use `segmentPointDistanceSq` for the enemy body → player collision check.

**Rationale:** Kamikazes at 220 px/s move 7.3 px per frame. With an 18 px kamikaze radius and 16 px player hitbox (combined 34 px), tunneling is unlikely but possible when a kamikaze dives at a player near the edge of the hitbox. Swept detection eliminates this class of bug entirely.

**Alternative considered:** Only fixing enemy bullets, not body collisions — rejected because the fix is equally simple and kamikazes are the highest-speed enemies.

### 3. No changes to shield check in `hitPlayer`

**Decision:** The `hitPlayer` function checks `player.shieldMs > 0` before applying damage. This remains unchanged — swept detection determines _whether_ a hit occurs, not _what happens_ after.

**Rationale:** Shield logic is orthogonal to collision geometry.

## Risks / Trade-offs

**[Minimal performance cost]** → `segmentPointDistanceSq` is ~4x more expensive than `distanceSq` (dot product + clamp + distance). At typical entity counts (<50 enemies, <20 bullets), this adds microseconds per tick. No mitigation needed.

**[Enemy prevX/prevY adds memory per enemy]** → Two extra numbers per RuntimeEnemy (16 bytes). With <50 enemies, this is ~800 bytes. Negligible.

**[Behavioral change for existing games]** → Swept detection will catch some collisions that point detection missed. This is the desired fix. No player-facing regression expected since it only makes hits _more_ reliable.
