## Context

The game already has a minimal pickup system: enemies drop `weapon` and `bomb` pickups that are tracked in `MatchRuntime.pickups`, collected in `resolveCollisions`, and broadcast in every `SnapshotState.pickups` array. Weapon pickups instantly raise `weaponLevel` (1→2→3 spread), and bomb pickups replenish the bomb count.

`PickupKind = "weapon" | "bomb"` is the current union. The snapshot already includes the full pickup list, so **no structural snapshot change is needed** — the proposal's "Modified Capabilities: snapshot" entry reflects adding `activeEffects` to `SnapshotPlayer`, not the pickup list itself.

The gap: no timed effects exist. Every pickup is instant and permanent. The feature adds **Shield** and **Rapid Fire** as time-limited power-up types, giving the game a richer risk/reward loop and visible momentary advantages.

## Goals / Non-Goals

**Goals:**
- Add two new timed power-up types: `shield` (invulnerability for a duration) and `rapid_fire` (halved fire interval for a duration).
- Track active effects per player on the server; expire them at tick time.
- Broadcast active effect state in `SnapshotPlayer` so clients can render HUD indicators.
- Expand `PickupKind` to include `"shield"` and `"rapid_fire"`.
- Drop new pickup types from appropriate kill events (shield from boss, rapid_fire from heavy/fighter).

**Non-Goals:**
- Stacking multiple instances of the same effect (last collected wins / timer resets).
- Client-side prediction of pickup collection.
- Persistent power-up state across matches or stages.
- Adding more than two new types in this change (future work).

## Decisions

### D1: Timed effects stored on RuntimePlayer, not a separate map

**Decision:** Add optional `shieldMs` and `rapidFireMs` countdown fields directly to `RuntimePlayer`.

**Rationale:** The player is already the unit of state; adding two nullable numbers is negligible overhead and avoids a lookup table. Future effects can follow the same pattern.

**Alternative considered:** A generic `Map<EffectKind, number>` — more flexible but adds indirection and serialization complexity for marginal gain at this scale.

---

### D2: Effect expiry in updatePlayers, applied before fire/movement logic

**Decision:** Decrement `shieldMs` / `rapidFireMs` by `deltaMs` inside `updatePlayers` before any shoot or movement logic runs.

**Rationale:** Ensures the effect is active exactly while the timer is positive. Fire interval check reads `rapidFireMs > 0`; invulnerability check reads `shieldMs > 0` in `hitPlayer`.

---

### D3: SnapshotPlayer carries active effect booleans (not remaining ms)

**Decision:** Add `shieldActive: boolean` and `rapidFireActive: boolean` to `SnapshotPlayer`.

**Rationale:** Clients only need to know *whether* an effect is on to render the HUD badge — not the remaining duration. Sending booleans keeps the snapshot compact and avoids client-side timer sync issues.

---

### D4: Drop rates and sources

**Decision:**
- `shield` drops exclusively from boss kills (guaranteed, replaces the existing guaranteed `bomb` drop).
- `rapid_fire` drops from fighter/heavy kills at the same 1-in-5 cadence currently used for `weapon` drops (`idCounter % 5 === 0`), replacing the `weapon` drop.

**Rationale:** Keeps the existing `maybeDropPickup` shape; just changes which `kind` is pushed. Bosses always reward with something special; rapid fire keeps general combat loot flowing.

**Alternative:** Keep `bomb` boss drop and add `shield` on top — rejected because it floods the arena after boss kills.

---

### D5: Effect durations as shared constants

**Decision:** Define `SHIELD_DURATION_MS = 5000` and `RAPID_FIRE_DURATION_MS = 4000` in `gameTypes.ts` (server-only for now, not shared).

**Rationale:** Duration values are server-authoritative; clients infer state from the boolean. No need to expose durations to the client package.

## Risks / Trade-offs

- **Shield timing lag:** Clients see `shieldActive` flip off one snapshot after server expiry (up to 33 ms late at 30 Hz). Acceptable for a visual indicator.
- **`weapon` type removal:** Replacing `weapon` drops with `rapid_fire` is a behavior change. Existing `weaponLevel` upgrade path still works, just requires a separate pickup event. If `weapon` drops are entirely removed, players max out at level 1. Decision: keep both — `rapid_fire` replaces the 1-in-5 roll, `weapon` drops on a separate 1-in-7 cadence for regular enemies (boss keeps `shield`).
- **`PickupKind` union expansion:** Any exhaustive switch on `PickupKind` in client code must be updated; TypeScript will surface this as a type error.

## Migration Plan

1. Update `PickupKind` in `packages/shared/src/index.ts` — add `"shield"` and `"rapid_fire"`.
2. Add `shieldActive` / `rapidFireActive` booleans to `SnapshotPlayer` in shared types.
3. Add `shieldMs` / `rapidFireMs` fields to `RuntimePlayer` in `gameTypes.ts`; update `createMatch` initial values to `0`.
4. Update `updatePlayers` in `game.ts` to decrement effect timers and apply rapid fire fire-interval override.
5. Update `hitPlayer` in `combat.ts` to respect `shieldMs > 0`.
6. Update `maybeDropPickup` in `combat.ts` for new drop kinds and rates.
7. Update `resolveCollisions` in `combat.ts` to apply shield/rapidFire effect on pickup instead of instantly modifying weaponLevel.
8. Update snapshot builder in `game.ts` to include `shieldActive` / `rapidFireActive`.
9. Update client rendering in `phaser/game.ts` to show pickup sprites and HUD badges.

No rollback mechanism needed — changes are additive except the `weapon` drop rate adjustment, which is tunable via constants.

## Open Questions

- Should `weapon` pickup remain as-is or be renamed to `weapon_upgrade`? Current plan: keep `"weapon"` to avoid breaking save-state references.
- Should the HUD badge show a countdown timer? Out of scope for this change — booleans only.
