## Why

The current weapon system only supports discrete bullet projectiles, making all three weapon levels feel similar — just more bullets in a spread. A continuous laser beam weapon adds a fundamentally different firing mechanic that rewards precision aiming and creates distinct tactical choices. It also raises the skill ceiling for experienced players who can track enemies with sustained beam contact.

## What Changes

- Add a new `PickupKind` value `"laser"` for the laser beam power-up
- Introduce a timed laser beam weapon mode that replaces the player's normal bullet fire while active
- The laser fires a continuous vertical beam from the player's position upward, dealing damage-per-tick to all enemies intersecting the beam
- Beam has a fixed width and extends from the player to the top of the screen
- Laser mode lasts for a limited duration (e.g., 6 seconds), after which the player reverts to their normal weapon level
- Laser pickups drop from enemies using the existing pickup spawning system
- Server performs beam-vs-enemy rectangle/circle intersection each tick
- Client renders the beam as a glowing vertical line with visual effects
- Snapshot protocol extended to communicate active laser state and beam geometry

## Capabilities

### New Capabilities
- `laser-beam`: Laser beam weapon mode — pickup acquisition, timed activation, beam collision detection, damage-per-tick, and client rendering

### Modified Capabilities
- `power-ups`: Adding `"laser"` as a new `PickupKind` and integrating laser pickup drops into the existing spawn logic
- `snapshot`: Extending snapshot data to include laser beam state for active players

## Impact

- **Shared types** (`packages/shared/src/index.ts`): New `PickupKind` variant, new snapshot fields for laser state
- **Server combat** (`apps/server/src/combat.ts`): New beam-vs-enemy collision function, integration into `resolveCollisions`, laser pickup drop logic
- **Server game loop** (`apps/server/src/game.ts`): Laser duration countdown, suppression of normal bullet fire during laser mode
- **Server types** (`apps/server/src/gameTypes.ts`): New `RuntimePlayer` fields for laser state
- **Client rendering** (`apps/client/src/phaser/game.ts`): Beam visual rendering, laser pickup sprite, HUD badge for active laser
- **Tests** (`apps/server/test/`): New tests for beam collision and laser lifecycle
