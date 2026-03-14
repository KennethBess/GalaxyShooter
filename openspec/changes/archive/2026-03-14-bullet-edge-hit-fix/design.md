## Context

Collision detection for player bullets is currently a **discrete point check**: each tick, `resolveCollisions` tests whether the bullet's current center position falls within `bullet.radius + enemy.radius` of an enemy center. This works when bullets move slowly relative to their radius, but player bullets travel at 540 px/s — 18 px/tick at 30 Hz — with a radius of only 5 px. When a bullet crosses an enemy's edge diagonally or tangentially, its start-of-tick and end-of-tick positions may both sit outside the collision circle while its actual path line passes through it, producing a visible near-miss that players experience as "the bullet went right through".

The bug surfaces most often against fighters (radius 20) where the combined radius is 25 px — just slightly larger than the 18 px bullet travel per tick — making diagonal edge grazes the failure mode.

## Goals / Non-Goals

**Goals:**
- Bullet-vs-enemy collision must detect any overlap between the bullet's swept line segment (previous position → current position) and the enemy's collision circle.
- Increase `PLAYER_BULLET_RADIUS` from 5 to 8 to close the gap between physics radius and rendered circle size.
- Change must not affect enemy bullet logic, bomb logic, or pickup collision (which are slow-moving and already point-checked correctly).

**Non-Goals:**
- Enemy bullet sweep detection (enemy bullets are slow; tunneling is not a problem at ≤ 250 px/s).
- Continuous collision detection for player–enemy body contacts.
- Client-side bullet rendering changes beyond the radius constant.

## Decisions

### D1: Swept segment vs point — store `prevX`/`prevY` on RuntimeBullet

**Decision:** Add `prevX: number` and `prevY: number` to `RuntimeBullet`. At the start of `updateBullets`, save current position into prev before integrating velocity.

**Rationale:** The minimum distance from a line segment to a point is the correct geometric primitive for swept-circle-vs-circle detection. Storing `prevX`/`prevY` avoids recomputing from velocity (which would require floating-point inversion and lose numerical precision from clamping).

**Alternative considered:** Re-derive prev position as `bullet.x - bullet.vx * (deltaMs/1000)`. Rejected: fragile if velocity changes mid-tick or is clamped.

---

### D2: Segment-to-point distance helper — `segmentPointDistanceSq`

**Decision:** Add `segmentPointDistanceSq(ax, ay, bx, by, px, py): number` to `gameTypes.ts` that returns the squared minimum distance from segment AB to point P.

**Implementation:**
```
t = clamp(dot(AP, AB) / dot(AB, AB), 0, 1)
closest = A + t * AB
return distanceSq(closest, P)
```

**Rationale:** Squared distance avoids a `Math.sqrt` on every bullet-enemy pair. Clamping `t` to [0, 1] keeps the projection on the segment rather than extending to the full line.

**Alternative:** `distanceSq` at mid-segment only — faster but misses non-midpoint grazes.

---

### D3: Radius increase — 5 → 8

**Decision:** Change `PLAYER_BULLET_RADIUS` from `5` to `8`.

**Rationale:** The rendered bullet arc is drawn at `radius: 5` on the client (`add.circle(..., 5, ...)`), but the segment sweep still reduces near-edge false negatives at radius 5. Raising to 8 closes the remaining perception gap between the visual bullet and its hit area without making the hit feel overpowered (8 px is still substantially smaller than any enemy radius).

**Alternative:** Keep radius at 5 and rely purely on sweep — acceptable but player feedback still shows visual narrow misses due to the small rendered circle.

## Risks / Trade-offs

- **Slightly more hits on diagonal shots** → Intentional; this is the correct behavior.
- **`prevX`/`prevY` initialized to same as `x`/`y` at bullet spawn** → On the first tick, the segment has zero length (point check only). Acceptable: the bullet spawns inside the player hitbox, never overlapping an enemy on the first frame.
- **New `segmentPointDistanceSq` must handle degenerate segment (start = end)** → `dot(AB, AB) = 0`; must guard with an `if` and fall back to `distanceSq(A, P)`.

## Migration Plan

1. Add `segmentPointDistanceSq` helper and update `PLAYER_BULLET_RADIUS` in `gameTypes.ts`.
2. Add `prevX`/`prevY` to `RuntimeBullet` interface.
3. Update all `RuntimeBullet` construction sites to include `prevX: x, prevY: y`.
4. Update `updateBullets` in `game.ts` to snapshot position before integration.
5. Update bullet-vs-enemy collision in `resolveCollisions` in `combat.ts` to use segment check.
6. Add regression test for edge-grazing bullet.

No deployment coordination needed — purely server-side physics change with no protocol impact.
