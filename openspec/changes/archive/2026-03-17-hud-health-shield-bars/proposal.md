## Why

Players currently have no visual feedback about their survivability state. The game uses one-hit kills with a binary shield, and the only HUD indicator is a text badge ("[SHIELD]") that conveys no duration information. Adding health and shield bars gives players critical at-a-glance information about their defensive state, improving tactical decision-making and game feel.

## What Changes

- **Add player health system**: Replace the current one-hit-kill model with a multi-hit health pool (e.g., 3 HP). Enemy contact and bullets deal 1 damage; players die when HP reaches 0. Respawn restores full HP.
- **Send shield remaining duration to clients**: Extend `SnapshotPlayer` to include `shieldRemainingMs: number` (0 when inactive) so clients can render a draining bar instead of a binary badge.
- **Render health bar on HUD**: Display a horizontal health bar in the HUD area showing current HP / max HP with color-coded segments (green → yellow → red).
- **Render shield bar on HUD**: Display a shield bar (or overlay on the health bar) that visually drains over time using the server-sent remaining duration.
- **Add visual feedback on damage**: Flash or shake the health bar when the player takes damage, providing immediate feedback.

## Capabilities

### New Capabilities
- `player-health`: Player health pool system — HP tracking, damage application, and respawn restoration on the server
- `hud-bars`: Client-side health and shield bar rendering in the Phaser HUD layer

### Modified Capabilities
- `snapshot`: SnapshotPlayer gains `hp`, `maxHp`, and `shieldRemainingMs` fields
- `power-ups`: Shield now absorbs damage (depleting shieldMs) rather than granting full invulnerability; damage while shielded reduces shield duration instead of being ignored

## Impact

- **Shared types**: `SnapshotPlayer` interface in `packages/shared/src/index.ts` gains new fields
- **Server game loop**: `combat.ts` hitPlayer logic changes from binary alive/dead to HP-based damage; `gameTypes.ts` RuntimePlayer gains `hp` and `maxHp`
- **Server snapshot**: `game.ts` snapshot builder includes new fields
- **Client rendering**: `apps/client/src/phaser/game.ts` gets new HUD bar GameObjects replacing the text-only effect badges
- **Existing tests**: `combat.test.ts` needs updates for multi-hit health behavior
