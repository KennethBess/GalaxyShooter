## Context

The game uses an authoritative server at 30 Hz with client-side prediction. Currently, three timing parameters cause perceived input lag when rapidly changing directions:

| Parameter | Current | Location |
|-----------|---------|----------|
| Input repeat interval | 90 ms | `game.ts` line 349 |
| Drift-lerp threshold | 96 px | `packages/shared` `DRIFT_LERP_THRESHOLD` |
| Self-player drift-correction factor | 0.12 | `game.ts` line 579 |

At 420 px/sec movement speed, these values allow 150-350 ms of visually wrong-direction movement before correction begins.

## Goals / Non-Goals

**Goals:**
- Direction changes feel immediate (perceived lag < 100 ms)
- Smooth correction when prediction diverges from server truth
- No server-side changes required

**Non-Goals:**
- Full client-side reconciliation / rollback (too complex for this change)
- Changing the server tick rate
- Input compression or batching optimizations

## Decisions

### 1. Reduce input repeat interval from 90 ms to 33 ms

**Approach:** Change the hard-coded `90` in the input repeat timer to `33` (one server tick at 30 Hz). This ensures held-input re-sends align with server tick boundaries, so direction changes reach the server within one tick.

**Why 33 ms:** Matches `1000 / TICK_RATE`. Sending faster than the tick rate wastes bandwidth; sending slower delays input by extra ticks.

**Alternative considered:** Sending on every client frame (16.67 ms at 60 FPS) — rejected as it doubles WebSocket messages with no server-side benefit since the server only reads input once per tick.

### 2. Lower DRIFT_LERP_THRESHOLD from 96 px to 40 px

**Approach:** Change the shared constant so drift correction kicks in at 40 px instead of 96 px.

**Why 40 px:** At 420 px/sec, 40 px = ~95 ms of movement — roughly 3 server ticks. This catches direction-reversal drift early while staying above per-frame jitter (~7 px). Below ~20 px, correction would fight normal prediction variance and cause visual jitter.

**Alternative considered:** Removing the threshold entirely (always correct) — rejected because sub-pixel and one-frame drift correction would cause jitter.

### 3. Increase self-player drift-correction factor from 0.12 to 0.25

**Approach:** Change the hard-coded `0.12` lerp factor in `interpolateSprites` for the `movingSelf` path to `0.25`.

**Why 0.25:** At 60 FPS with a 100 px drift:
- 0.12/frame: ~33 frames (550 ms) to converge — too slow
- 0.25/frame: ~9 frames (150 ms) to converge — responsive without snapping
- 0.42/frame: ~5 frames (83 ms) — risks overshooting and oscillation

**Alternative considered:** Using the dynamic `factor` (0.18-0.42) from the main interpolation path — rejected because its variance based on frame delta could cause inconsistent correction feel for the self-player.

## Risks / Trade-offs

- **[Increased WebSocket message rate]** → From ~11 msgs/sec to ~30 msgs/sec per player while keys held. Acceptable for a small-room multiplayer game (4-8 players). Monitor in production.
- **[Visible correction jitter at 40 px threshold]** → Mitigated by keeping threshold above per-frame movement (~7 px). If jitter occurs, raise to 50-60 px.
- **[0.25 lerp may feel "springy"]** → Playtest and adjust. Can be raised to 0.3 or lowered to 0.2 without changing the architecture.
