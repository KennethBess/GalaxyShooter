## Why

Players expect arrow keys to work for movement in browser games — it's the most common keyboard control scheme alongside WASD. Currently only WASD is supported, which creates friction for players who prefer arrow keys or use non-QWERTY keyboard layouts where WASD positions are unintuitive.

## What Changes

- Add arrow key bindings (Up/Down/Left/Right) as alternative movement controls alongside existing WASD keys
- Arrow keys and WASD will work simultaneously — pressing either set produces the same `InputState`
- No changes to the server-side input protocol or movement physics; the `InputState` interface remains unchanged

## Capabilities

### New Capabilities
- `arrow-key-input`: Alternative keyboard input bindings using arrow keys for player movement, coexisting with WASD controls

### Modified Capabilities

_(none — the input protocol and server-side handling remain identical)_

## Impact

- **Client only**: Changes are isolated to `apps/client/src/phaser/game.ts` where keyboard bindings and input polling occur
- **No protocol changes**: The `InputState` shape (`up/down/left/right/shoot` booleans) and `PlayerInputMessage` are unchanged
- **Note**: The `altShoot` key is currently bound to `KeyCodes.UP` (arrow up) for shooting. This conflicts with using arrow-up for movement and must be resolved — arrow-up should become movement, and an alternative shoot key (or removal of `altShoot`) should be considered
