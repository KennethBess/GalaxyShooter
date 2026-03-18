## 1. Reduce Input Repeat Interval

- [x] 1.1 Change the input repeat interval from `90` to `33` in both assignments in `apps/client/src/phaser/game.ts` (the `changed` branch and the `else if` branch)

## 2. Lower Drift-Lerp Threshold

- [x] 2.1 Change `DRIFT_LERP_THRESHOLD` from `96` to `40` in `packages/shared/src/index.ts`

## 3. Increase Self-Player Drift Correction Factor

- [x] 3.1 Change the hard-coded `0.12` lerp factor to `0.25` in the `movingSelf` drift-correction path in `apps/client/src/phaser/game.ts`

## 4. Verification

- [x] 4.1 Run `npm run build` and confirm no type errors
- [x] 4.2 Run `npm test` and confirm all tests pass
