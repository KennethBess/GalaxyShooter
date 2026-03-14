## 1. Shared Types

- [x] 1.1 Add `LeaderboardEntry` interface to `packages/shared/src/index.ts` with fields: id, playerName, score, mode, stageReached, durationMs, playerCount, achievedAt, rank
- [x] 1.2 Add optional `leaderboardRank: number | null` field to `ResultSummary` interface

## 2. Leaderboard Repository

- [x] 2.1 Create `LeaderboardRepository` interface in `apps/server/src/leaderboardRepository.ts` with `submit(entry)` and `getTopScores(mode, limit)` methods
- [x] 2.2 Implement `InMemoryLeaderboardRepository` — sorted array capped at 20 entries per mode
- [x] 2.3 Implement `RedisLeaderboardRepository` — `ZADD` to sorted set, `ZREMRANGEBYRANK` trim, hash keys for metadata, `ZREVRANGE` + `HGETALL` for reads
- [x] 2.4 Wire repository into server startup in `apps/server/src/index.ts` (Redis when `REDIS_URL` is set, in-memory otherwise)

## 3. Score Submission at Match End

- [x] 3.1 Call `leaderboardRepository.submit()` in the match-end path in `apps/server/src/combat.ts` (both victory and defeat outcomes)
- [x] 3.2 Set `leaderboardRank` on `ResultSummary` from the submit result; default to `null` on failure
- [x] 3.3 Wrap submission in try/catch so errors are logged but never block `match_result` delivery

## 4. REST Endpoint

- [x] 4.1 Add `GET /api/leaderboard` route in `apps/server/src/index.ts` with `mode` query param validated via Zod
- [x] 4.2 Return JSON array of `LeaderboardEntry` objects (up to 20), or 400 for invalid mode

## 5. Client API & State

- [x] 5.1 Add `fetchLeaderboard(mode)` function in `apps/client/src/api.ts` calling `GET /api/leaderboard?mode=...`
- [x] 5.2 Store `leaderboardRank` from `match_result` payload in client state for post-match highlighting

## 6. Leaderboard Screen — HTML & Navigation

- [x] 6.1 Add `scores` screen markup in `apps/client/src/app.ts` using `front-page > front-shell > front-card` structure with mode tabs, entry list container, loading/empty/error states, and back button
- [x] 6.2 Add "Leaderboard" button to the landing page navigating to the scores screen
- [x] 6.3 Update "High Scores" button on the results page to navigate to the scores screen (pre-selecting the match mode)
- [x] 6.4 Implement back-button navigation returning to the previous screen (landing or results)

## 7. Leaderboard Screen — Data & Rendering

- [x] 7.1 Fetch and render leaderboard entries on screen load with rank, player name, score, stage reached, and date columns
- [x] 7.2 Implement mode tab switching — fetch new data and re-render on tab click
- [x] 7.3 Apply gold/silver/bronze accent styling to ranks 1-3
- [x] 7.4 Highlight the player's new entry when navigating from results with a non-null `leaderboardRank`
- [x] 7.5 Show loading spinner while fetching, empty-state message when no entries, and error message with retry button on failure

## 8. Leaderboard Screen — CSS & Animation

- [x] 8.1 Add leaderboard layout styles in `apps/client/src/style.css` — row grid, rank badge styling, mode tab toggles, responsive breakpoints (hide date column below 768px)
- [x] 8.2 Add gold (`#ffd700`), silver (`#c0c0c0`), bronze (`#cd7f32`) rank accent colors
- [x] 8.3 Add staggered row-entry animation (reuse `resultRowIn` pattern with per-row delay), respecting `prefers-reduced-motion`
- [x] 8.4 Add highlight glow style for the player's newly placed entry

## 9. Tests

- [x] 9.1 Add unit tests for `InMemoryLeaderboardRepository` — submit, top-20 trim, ranking, multi-mode isolation
- [x] 9.2 Add integration test for `GET /api/leaderboard` endpoint — valid mode, invalid mode, empty response
- [x] 9.3 Add test for `leaderboardRank` presence in `ResultSummary` after match end
