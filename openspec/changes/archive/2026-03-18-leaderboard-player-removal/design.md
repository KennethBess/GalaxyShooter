## Context

The leaderboard currently supports submitting and querying scores but has no deletion capability. The `LeaderboardRepository` interface exposes `submit()` and `getTopScores()`. Entries are stored in Redis as sorted sets (scores) plus hashes (metadata). The client renders a read-only leaderboard screen. There is no authentication layer — the game is a casual multiplayer browser game without user accounts.

## Goals / Non-Goals

**Goals:**
- Add `deleteEntry(id): Promise<boolean>` to the repository interface and both implementations
- Expose `DELETE /api/leaderboard/:id` returning 204/404
- Add a per-row remove button to the client leaderboard UI with confirmation
- Re-fetch the leaderboard after successful deletion to show updated ranks

**Non-Goals:**
- Authentication or authorization (no user accounts exist — this is acceptable for the current scope)
- Batch deletion or "clear all" functionality
- Audit logging of deletions
- Soft-delete or undo capability

## Decisions

### 1. Repository method returns boolean
`deleteEntry(id)` returns `true` if an entry was removed, `false` if the ID was not found. This maps cleanly to 204 vs 404 at the route level without needing exceptions.

**Alternative considered:** Throwing a `NotFoundError` — rejected because the repository layer is simple and boolean is sufficient for a single operation.

### 2. Redis deletion: pipeline DEL hash + ZREM sorted set
Both the hash (`leaderboard:entry:{id}`) and the sorted set member must be removed. A Redis pipeline ensures both operations happen atomically. The sorted set key is derived from the mode stored in the hash, so the hash is read first to determine which sorted set to update.

**Alternative considered:** Scanning all mode sorted sets — rejected because reading the hash first is O(1) and avoids unnecessary scans.

### 3. Client uses `window.confirm()` for deletion confirmation
A simple `confirm()` dialog before sending the delete request. No custom modal needed — keeps implementation minimal and consistent with the game's casual nature.

**Alternative considered:** Custom modal component — rejected as over-engineering for a simple confirmation.

### 4. Remove button styled as subtle "×" icon
The remove button is a small "×" on each row, visible but not visually dominant. It uses the existing `--text-dim` color and becomes `--accent` on hover.

## Risks / Trade-offs

- **No auth** → Anyone can delete any entry. This is acceptable for the current scope since the game has no user accounts. If abuse becomes a problem, rate limiting or a simple admin key can be added later.
- **Race condition** → Two users deleting the same entry simultaneously. The second delete will get a 404, which the client handles gracefully by re-fetching.
- **Hash read before delete** → One extra Redis round-trip to read the mode from the hash before removing from the sorted set. Negligible latency for a single delete operation.
