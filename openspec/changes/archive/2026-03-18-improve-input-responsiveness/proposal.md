## Why

When quickly changing the spaceship's direction (e.g., left then right), the ship sometimes continues moving the wrong way for 150-350 ms before correcting. Three client-side issues compound: the 90 ms input-repeat interval delays new directions from reaching the server, the drift-correction lerp (0.12 fixed factor) is too slow to reconcile prediction errors, and no correction occurs at all below the 96 px drift threshold — letting errors accumulate silently.

## What Changes

- Reduce the input repeat interval from 90 ms to ~33 ms (one server tick) so direction changes reach the server within one tick
- Lower the drift-lerp threshold so correction begins earlier and prediction errors don't grow unchecked
- Increase the self-player drift-correction lerp factor so the client converges on the server position faster when predictions diverge
- Keep server-side input handling and physics unchanged

## Capabilities

### New Capabilities
- `input-responsiveness`: Client-side input timing and drift-correction tuning for responsive movement feel

### Modified Capabilities

_(none — the existing snapshot and input protocol specs are unchanged)_

## Impact

- **Client only**: All changes in `apps/client/src/phaser/game.ts` (input repeat timing, drift thresholds, lerp factor) and `packages/shared/src/index.ts` (constant values)
- **No protocol/server changes**: `InputState`, `PlayerInputMessage`, tick loop, and snapshot broadcast are unaffected
- **Tuning risk**: Over-aggressive correction could cause jitter; values need playtesting
