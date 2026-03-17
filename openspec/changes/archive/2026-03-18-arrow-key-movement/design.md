## Context

Player movement is captured in `apps/client/src/phaser/game.ts` using Phaser's `addKeys` API. Currently, WASD keys are mapped to directional input and `KeyCodes.UP` (arrow up) is mapped to `altShoot`. The update loop polls these keys each frame and emits an `InputState` to the server when changes are detected. The server-side input protocol (`InputState` / `PlayerInputMessage`) and physics are unaffected by this change.

## Goals / Non-Goals

**Goals:**
- Arrow keys (Up/Down/Left/Right) work as movement controls alongside WASD
- Both control schemes work simultaneously without conflict
- Resolve the arrow-up / altShoot conflict

**Non-Goals:**
- Rebindable or configurable key mappings (future work)
- Gamepad or touch input changes
- Any server-side changes

## Decisions

### 1. Add separate arrow-key bindings and OR them with WASD in the polling loop

**Approach:** Register arrow keys as additional Phaser key objects (e.g., `arrowUp`, `arrowDown`, `arrowLeft`, `arrowRight`) in the `addKeys` call. In the update loop, OR each arrow key's `isDown` state with the corresponding WASD key:

```typescript
up: this.inputKeys.up.isDown || this.inputKeys.arrowUp.isDown,
```

**Why:** This keeps the existing WASD bindings untouched, requires minimal code change, and leverages Phaser's built-in key polling. No new abstractions needed.

**Alternative considered:** Using Phaser's `createCursorKeys()` — rejected because it returns a separate object structure and would add unnecessary indirection when we can just add keys to the existing `addKeys` map.

### 2. Remove the `altShoot` binding on arrow-up

**Approach:** Remove the `altShoot: Phaser.Input.Keyboard.KeyCodes.UP` entry from `addKeys` and remove its usage in the shoot input check. Spacebar remains the sole shoot key.

**Why:** Arrow-up must be movement, not shoot. Having two purposes for the same key creates a conflict. Spacebar is the standard shoot key and is already the primary binding.

## Risks / Trade-offs

- **[Removing altShoot may surprise existing players]** → Low risk. Arrow-up as shoot is non-standard and likely used by very few players. Spacebar is the expected shoot key.
- **[Browser default arrow-key scrolling]** → Phaser already calls `preventDefault` on registered keys when the canvas is focused, so no additional handling needed.
