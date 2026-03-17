## Context

The game currently uses a one-hit-kill model: players are either alive (optionally shielded) or dead. The client HUD shows only text badges like `[SHIELD]` with no duration information. Players lack visual feedback about their survivability, making the game feel punishing and opaque.

The server already tracks `shieldMs` duration internally but only sends a boolean to clients. The Phaser client uses simple `Text` GameObjects for HUD elements.

## Goals / Non-Goals

**Goals:**
- Introduce a multi-hit health system (3 HP) with visual health bar
- Send shield remaining duration to clients for a draining shield bar
- Provide damage feedback through bar flash effects
- Keep the implementation minimal — bars only, no rework of other HUD elements

**Non-Goals:**
- Enemy health bars (enemies already use sprite scaling for HP)
- Health regeneration or healing pickups
- Rapid fire / laser duration bars (future follow-up)
- Damage numbers or floating text
- Minimap or other HUD additions

## Decisions

### D1: Health model — 3 HP with damage invulnerability

Add `hp: number` and `maxHp: number` to `RuntimePlayer`. Set `PLAYER_MAX_HP = 3`. On hit (when not shielded/invulnerable), decrement `hp` by 1 and grant `DAMAGE_INVULN_MS = 1000` of invulnerability to prevent instant multi-hit deaths.

**Why not 5 or 10 HP?** 3 HP keeps the game fast-paced. With 30 Hz ticks and enemies, higher HP would require rebalancing all enemy spawn rates and difficulty curves. 3 is the minimal viable change.

**Alternative: fractional/percentage health.** Rejected — discrete HP is simpler to render (segmented bar) and reason about for balancing.

### D2: Shield remains full invulnerability (no HP absorption)

Shield continues to block all damage while active rather than absorbing a fixed number of hits. This preserves existing balance and keeps the shield feeling powerful as a pickup reward.

**Alternative: Shield absorbs N hits.** Would require tracking shield HP separately — added complexity for a v1 feature. Can revisit if 3 HP + full shield feels too forgiving.

### D3: Extend SnapshotPlayer with hp, maxHp, shieldRemainingMs

Add three fields to the shared `SnapshotPlayer` interface:
- `hp: number` — current health
- `maxHp: number` — max health (constant, but sent per-player for flexibility)
- `shieldRemainingMs: number` — milliseconds of shield remaining (0 when inactive)

The server populates these in the snapshot builder. This is a backward-compatible additive change to the wire format.

**Why send maxHp?** Allows future per-ship or per-mode HP tuning without client changes.

### D4: Phaser Graphics-based bars, not DOM overlay

Render bars using `Phaser.GameObjects.Graphics` on the GameScene at a high depth, consistent with how bullets are already rendered. This keeps everything in the Phaser rendering pipeline with no DOM/CSS complexity.

**Position:** Below the existing text HUD (y ≈ 80), left-aligned (x = 20). Health bar: 200×16px. Shield bar: 200×12px, rendered below health bar only when active.

**Alternative: DOM overlay.** Would enable CSS animations but breaks the single-canvas rendering model and adds z-index coordination issues.

### D5: Client-side shield bar interpolation

Between snapshots (33ms gaps at 30 Hz), the client decreases the displayed shield fill by elapsed time. On each new snapshot, it snaps to the authoritative value. This produces smooth draining without requiring higher tick rates.

### D6: Damage flash via tween

When `hp` decreases between consecutive snapshots, apply a 200ms red tint tween to the health bar graphics. Use Phaser's built-in tween system. Skip the flash when transitioning from dead → alive (respawn).

## Risks / Trade-offs

**[Balance shift]** Moving from 1-hit to 3-hit significantly changes difficulty. → Mitigation: `PLAYER_MAX_HP` is a constant in shared, easily tunable. May need to adjust enemy spawn rates in a follow-up.

**[Wire format size increase]** Three new numeric fields per player per snapshot at 30 Hz. → Mitigation: ~12 bytes per player per snapshot is negligible at current player counts (2-4 per room).

**[Shield bar interpolation drift]** Client-side countdown may drift from server if frame rate varies. → Mitigation: Snap to server value every snapshot (33ms). Max drift is one frame interval — imperceptible.

**[Test updates]** Existing combat tests assume one-hit kills. → Mitigation: Update tests alongside implementation; the HP constant makes tests straightforward.
