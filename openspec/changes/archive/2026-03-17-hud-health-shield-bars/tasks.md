## 1. Shared Types

- [x] 1.1 Add `PLAYER_MAX_HP` (3) and `DAMAGE_INVULN_MS` (1000) constants to `packages/shared/src/index.ts`
- [x] 1.2 Add `hp`, `maxHp`, and `shieldRemainingMs` fields to the `SnapshotPlayer` interface in `packages/shared/src/index.ts`

## 2. Server — Player Health

- [x] 2.1 Add `hp` and `maxHp` fields to `RuntimePlayer` in `apps/server/src/gameTypes.ts`
- [x] 2.2 Initialize `hp = PLAYER_MAX_HP` on player spawn and respawn in `roomService.ts` / `game.ts`
- [x] 2.3 Update `hitPlayer` in `apps/server/src/combat.ts` to decrement `hp` by 1 instead of instant kill, grant `DAMAGE_INVULN_MS` invulnerability, and only kill when `hp` reaches 0

## 3. Server — Snapshot Extension

- [x] 3.1 Include `hp`, `maxHp`, and `shieldRemainingMs` (from `shieldMs`) in the snapshot builder in `apps/server/src/game.ts`

## 4. Client — HUD Bar Rendering

- [x] 4.1 Add health bar Graphics object to GameScene in `apps/client/src/phaser/game.ts`, positioned below existing text HUD (x=20, y≈80, 200×16px)
- [x] 4.2 Add shield bar Graphics object below health bar (200×12px), visible only when `shieldRemainingMs > 0`
- [x] 4.3 Update health bar fill each snapshot based on `hp / maxHp` with green→yellow→red color gradient
- [x] 4.4 Implement shield bar smooth drain using client-side elapsed time interpolation between snapshots, snapping to server value on each new snapshot

## 5. Client — Damage Feedback

- [x] 5.1 Track previous snapshot `hp` value and trigger a 200ms red flash tween on the health bar when `hp` decreases
- [x] 5.2 Suppress flash on respawn (transition from `alive: false` to `alive: true`)

## 6. Tests

- [x] 6.1 Update existing combat tests in `apps/server/test/combat.test.ts` for multi-hit HP behavior (damage reduces HP, death at 0 HP, damage invulnerability window)
- [x] 6.2 Add test: shield blocks damage without reducing HP
- [x] 6.3 Add test: snapshot includes `hp`, `maxHp`, and `shieldRemainingMs` fields
