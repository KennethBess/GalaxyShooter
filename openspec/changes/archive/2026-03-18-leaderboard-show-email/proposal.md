## Why

Leaderboard entries currently show only the player's display name. There is no way to identify which registered player achieved a score. Showing the email lets organizers verify who is on the leaderboard and contact top players.

## What Changes

- Add `email` field to `LeaderboardEntry` and `LeaderboardSubmission` shared types
- Thread the registered player's email from the client through room creation/joining to the server's player slot
- Include email when submitting leaderboard scores after a match
- Store email in the leaderboard Redis hash and in-memory store
- Display email on each leaderboard entry row in the client UI

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `leaderboard-persistence`: Adding `email` field to submission, storage, and retrieval
- `leaderboard-ui`: Displaying email on each leaderboard row

## Impact

- **Shared types**: `LeaderboardEntry`, `LeaderboardSubmission` gain `email` field; `CreateRoomRequest` and `JoinRoomRequest` gain optional `email` field
- **Server**: `matchService.ts` passes email from player slot to leaderboard submission; `leaderboardRepository.ts` stores/retrieves email; `roomService.ts` stores email on player slot
- **Client**: `app.ts` sends email when creating/joining rooms; leaderboard rows display email; `api.ts` passes email in requests
