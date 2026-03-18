## Context

The leaderboard system currently supports two operations: `submit` and `getTopScores`, backed by either Redis sorted sets or an in-memory Map. There is no way to clear scores. During development/testing or after game balance changes, stale scores accumulate with no removal mechanism.

The existing `LeaderboardRepository` interface is implemented by `InMemoryLeaderboardRepository` and `RedisLeaderboardRepository` in `apps/server/src/leaderboardRepository.ts`. The REST layer is defined in `apps/server/src/index.ts`. The client leaderboard UI lives in `apps/client/src/app.ts`.

## Goals / Non-Goals

**Goals:**
- Allow clearing all leaderboard entries for a specific game mode via a REST endpoint
- Support clearing all modes in a single call
- Provide a client-side reset button gated behind a dev/admin flag
- Confirm before executing to prevent accidental data loss

**Non-Goals:**
- Authentication/authorization (no user system exists yet — gate via query param for now)
- Deleting individual entries
- Audit logging of reset operations beyond console logging

## Decisions

### Decision 1: `DELETE /api/leaderboard?mode={campaign|survival|all}` endpoint

Add a DELETE route accepting a `mode` query parameter. When `mode` is `campaign` or `survival`, only that mode's data is cleared. When `mode` is `all`, both modes are cleared.

**Rationale:** Follows REST conventions (DELETE for destructive operations). Reuses the existing mode validation pattern. The `all` option avoids requiring two calls during full resets.

**Alternative considered:** POST `/api/leaderboard/reset` — rejected because DELETE on the collection resource is more idiomatic.

### Decision 2: Add `reset(mode: GameMode | "all")` to `LeaderboardRepository` interface

Both `InMemoryLeaderboardRepository` and `RedisLeaderboardRepository` implement this method.

- **In-memory:** Delete the board entry from the Map (or clear both).
- **Redis:** Retrieve all entry IDs from the sorted set, delete their hash keys, then delete the sorted set key. Use a pipeline for atomicity.

**Rationale:** Keeps the repository interface symmetric — every storage backend supports the same operations.

### Decision 3: Client reset button gated by `?admin=1` query parameter

The "Reset Scores" button only renders on the leaderboard screen when `window.location.search` contains `admin=1`. This is a lightweight dev-time gate — not a security mechanism.

**Rationale:** Simple to implement, no backend auth needed. Sufficient for a development/testing tool. A proper admin panel with authentication is out of scope.

### Decision 4: Browser `confirm()` dialog before reset

Use the native `confirm()` dialog to require explicit user confirmation before calling the DELETE endpoint. This prevents accidental clicks.

**Rationale:** Zero-dependency, immediate protection against accidental resets. A custom modal would be over-engineered for a dev tool.

## Risks / Trade-offs

- **No auth on DELETE endpoint** → Acceptable for local dev; in production, the endpoint is only reachable behind Azure Container Apps networking. If public exposure becomes a concern, add an API key check later.
- **Redis pipeline for bulk delete** → If the sorted set is very large, the `ZRANGE` + bulk `DEL` could be slow. Mitigated by the 20-entry cap — the set is always small.
- **`confirm()` is blocking** → Acceptable for a rarely-used admin action. No UX concern.
