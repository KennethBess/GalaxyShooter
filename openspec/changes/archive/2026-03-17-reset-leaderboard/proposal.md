## Why

There is currently no way to reset or clear the leaderboard. During development, testing, or after a significant game balance change, scores become stale or invalid. Operators and developers need the ability to wipe leaderboard data — either for a specific game mode or all modes at once.

## What Changes

- Add a `DELETE /api/leaderboard` server endpoint that clears all scores for a given mode (or all modes)
- Add a `reset()` method to the `LeaderboardRepository` interface and both implementations (Redis, in-memory)
- Add a "Reset Scores" button to the client leaderboard screen (visible only when an admin query parameter or local-dev flag is present)
- Add confirmation dialog before executing the reset to prevent accidental data loss

## Capabilities

### New Capabilities
- `leaderboard-reset`: Server-side ability to clear leaderboard entries by mode, exposed via a REST endpoint, with a client-side admin trigger

### Modified Capabilities
- `leaderboard-persistence`: Adding a `reset` operation to the repository interface and both storage implementations
- `leaderboard-ui`: Adding a reset button and confirmation flow to the leaderboard screen

## Impact

- **Server**: New `DELETE /api/leaderboard` route in `index.ts`; new `reset()` method on `LeaderboardRepository` interface in `leaderboardRepository.ts`
- **Client**: New reset button + confirmation dialog in `app.ts`; new `resetLeaderboard()` API call in `api.ts`
- **Shared**: No type changes expected (reset returns void/empty)
- **Tests**: New test cases for the reset operation in `leaderboard.test.ts`
