## Why

The leaderboard currently has no way to remove individual entries. If a player submits an offensive name or a score is recorded incorrectly, there is no mechanism to clean it up. An admin-facing delete endpoint and a client-side removal action are needed to maintain leaderboard integrity.

## What Changes

- Add a `DELETE /api/leaderboard/:id` server endpoint that removes a single entry by ID from both the Redis sorted set and its metadata hash
- Add a remove/delete button per entry in the client leaderboard UI (visible to all users for now — no auth layer exists)
- Add a `deleteEntry(id)` method to the `LeaderboardRepository` interface and both implementations (Redis + in-memory)

## Capabilities

### New Capabilities

- `leaderboard-removal`: Server-side deletion of individual leaderboard entries and client UI for triggering removal

### Modified Capabilities

- `leaderboard-persistence`: Adding a delete operation to the repository interface and Redis/in-memory implementations
- `leaderboard-ui`: Adding a remove button per leaderboard row with confirmation

## Impact

- **Server**: New route in `index.ts`, new method in `leaderboardRepository.ts` (both implementations)
- **Client**: Updated leaderboard rendering in `app.ts`, new API call in `api.ts`, new CSS for delete button
- **Shared types**: No changes expected (existing `LeaderboardEntry.id` is sufficient for identification)
