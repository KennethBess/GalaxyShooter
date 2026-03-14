## Why

Galaxy Shooter tracks high scores only in browser localStorage — scores are lost when players switch devices or clear storage, and there's no way to compare performance across the player base. A server-persisted global leaderboard creates competitive motivation, gives matches lasting significance, and adds a polished, professional feel to the game.

## What Changes

- **Server-side score persistence**: After each match, the server writes the result to a Redis sorted set, retaining the top 20 entries per game mode.
- **Leaderboard REST API**: New `GET /api/leaderboard` endpoint returns the top 20 scores, filterable by game mode (campaign / survival).
- **Global leaderboard UI**: A dedicated, professionally designed leaderboard screen accessible from the front page and the results screen, featuring rank numbers, player names, scores, stage reached, game mode, and timestamps — styled to match the existing space aesthetic with smooth animations.
- **Post-match highlight**: When a player's score lands on the leaderboard, the results screen highlights their new ranking.

## Capabilities

### New Capabilities

- `leaderboard-persistence`: Server-side storage and retrieval of the top 20 scores per game mode using Redis sorted sets, with a REST endpoint for querying rankings.
- `leaderboard-ui`: A visually polished, responsive leaderboard screen with mode filtering, rank display, animated entry transitions, and post-match rank highlighting.

### Modified Capabilities

_(none — no existing spec-level requirements change)_

## Impact

- **Server (`apps/server`)**: New `leaderboardRepository.ts` for Redis sorted-set operations; new `/api/leaderboard` route in `index.ts`; score submission call added to match-end logic in `game.ts`.
- **Shared (`packages/shared`)**: New `LeaderboardEntry` type and `LeaderboardMessage` types added to the shared type definitions.
- **Client (`apps/client`)**: New leaderboard screen in `app.ts`; new navigation buttons on the landing and results pages; additional CSS for leaderboard layout, rank badges, and animations.
- **Redis**: Two new sorted-set keys (`leaderboard:campaign`, `leaderboard:survival`) with associated hash keys for entry metadata. No schema migration needed — additive only.
- **No breaking changes** to existing APIs, WebSocket protocol, or game logic.
