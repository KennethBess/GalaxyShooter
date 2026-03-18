## 1. Update Key Bindings

- [x] 1.1 Add arrow key entries (`arrowUp`, `arrowDown`, `arrowLeft`, `arrowRight`) to the `addKeys` call in `apps/client/src/phaser/game.ts`
- [x] 1.2 Remove the `altShoot` key binding (`KeyCodes.UP`) from the `addKeys` call

## 2. Update Input Polling

- [x] 2.1 OR each arrow key with its WASD counterpart in the `InputState` construction (`up: this.inputKeys.up.isDown || this.inputKeys.arrowUp.isDown`, etc.)
- [x] 2.2 Remove the `altShoot` reference from the shoot input check (`this.inputKeys.altShoot.isDown`)
- [x] 2.3 Update the `inputKeys` type definition on the `GameScene` class to include the new arrow key fields and remove `altShoot`

## 3. Verification

- [x] 3.1 Run `npm run build` and confirm no type errors
- [x] 3.2 Run `npm run lint` and confirm no lint errors
