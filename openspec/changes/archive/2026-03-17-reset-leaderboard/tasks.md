## 1. Repository Layer

- [x] 1.1 Add `reset(mode: GameMode | "all"): Promise<void>` to the `LeaderboardRepository` interface in `apps/server/src/leaderboardRepository.ts`
- [x] 1.2 Implement `reset()` in `InMemoryLeaderboardRepository` — delete the board for the given mode, or clear all boards when mode is `"all"`
- [x] 1.3 Implement `reset()` in `RedisLeaderboardRepository` — retrieve entry IDs from the sorted set, delete their hash keys, and delete the sorted set key using a pipeline. Handle `"all"` by repeating for both modes.

## 2. Server Endpoint

- [x] 2.1 Add a Zod schema for the reset mode parameter that accepts `campaign`, `survival`, or `all`
- [x] 2.2 Add `DELETE /api/leaderboard` route in `apps/server/src/index.ts` — validate the `mode` query param, call `leaderboardRepo.reset(mode)`, return `{ "cleared": mode }` on success or 400/500 on error

## 3. Client API and UI

- [x] 3.1 Add `resetLeaderboard(mode: string): Promise<void>` function in `apps/client/src/api.ts` that sends `DELETE /api/leaderboard?mode={mode}`
- [x] 3.2 Add a "Reset Scores" button to the leaderboard screen in `apps/client/src/app.ts`, visible only when `admin=1` is in the URL query string
- [x] 3.3 Wire the button click to show a `confirm()` dialog, call `resetLeaderboard()` with the current tab's mode on confirmation, and refresh the leaderboard view on success

## 4. Tests

- [x] 4.1 Add tests for `reset()` in `apps/server/test/leaderboard.test.ts` — single mode reset, all-mode reset, reset on empty board, and verify other mode is unaffected
- [x] 4.2 Add test for the `DELETE /api/leaderboard` endpoint — valid mode, invalid mode, and successful clearing
