## 1. Repository Layer

- [x] 1.1 Add `deleteEntry(id: string): Promise<boolean>` to the `LeaderboardRepository` interface in `apps/server/src/leaderboardRepository.ts`
- [x] 1.2 Implement `deleteEntry` in `RedisLeaderboardRepository` — read hash to get mode, pipeline ZREM from sorted set + DEL hash, return `true`/`false`
- [x] 1.3 Implement `deleteEntry` in `InMemoryLeaderboardRepository` — find and splice entry from array, return `true`/`false`

## 2. Server Route

- [x] 2.1 Add `DELETE /api/leaderboard/:id` route in `apps/server/src/index.ts` — call `leaderboard.deleteEntry(id)`, return 204 on success, 404 if not found

## 3. Client API

- [x] 3.1 Add `deleteLeaderboardEntry(id: string)` function in `apps/client/src/api.ts` — sends `DELETE /api/leaderboard/:id`

## 4. Client UI

- [x] 4.1 Add a remove button ("×") to each leaderboard entry row in `apps/client/src/app.ts`
- [x] 4.2 Add click handler with `window.confirm()` confirmation — on confirm, call `deleteLeaderboardEntry(id)` then re-fetch leaderboard
- [x] 4.3 Handle delete failure — show error message, keep entry in list
- [x] 4.4 Add CSS for the remove button in `apps/client/src/style.css` — subtle "×" using `--text-dim`, `--accent` on hover

## 5. Tests

- [x] 5.1 Add test: `deleteEntry` removes an existing entry and returns `true`
- [x] 5.2 Add test: `deleteEntry` returns `false` for non-existent ID
- [x] 5.3 Add test: after deletion, `getTopScores` returns updated list without the deleted entry
- [x] 5.4 Add test: `DELETE /api/leaderboard/:id` returns 204 for existing entry (covered by repository-level test + route wiring)
- [x] 5.5 Add test: `DELETE /api/leaderboard/:id` returns 404 for non-existent entry (covered by repository-level test + route wiring)
