## Context

Scores are currently stored only in browser localStorage (top 10, local to device). The server already persists room state to Redis and exposes REST endpoints for room management. The `ResultSummary` type contains all data needed for a leaderboard entry (score, mode, stage, players, duration). The client has an existing "High Scores" button on the results screen that reads from localStorage — this will be upgraded to show global rankings.

## Goals / Non-Goals

**Goals:**

- Persist the top 20 scores per game mode (campaign, survival) server-side in Redis
- Expose a REST endpoint to query leaderboard rankings
- Submit scores automatically at match end — no player action required
- Build a professional leaderboard screen matching the existing space-themed UI
- Highlight a player's rank on the results screen when they place on the board
- Keep localStorage high scores as a local fallback (no removal of existing feature)

**Non-Goals:**

- User accounts or authentication — entries are identified by player name only
- Anti-cheat or score validation beyond server-authoritative scoring (already enforced)
- Pagination or infinite scroll — fixed top 20 only
- Per-player history or statistics pages
- Real-time leaderboard updates via WebSocket (poll on page load is sufficient)

## Decisions

### 1. Redis sorted sets for ranking storage

**Decision:** Use Redis sorted sets (`ZADD` / `ZREVRANGE`) with score as the sort value, one key per game mode.

**Why:** Sorted sets are purpose-built for leaderboards — `ZREVRANGE` returns top-N in O(log N + M) with no application-level sorting. The existing Redis connection is already available via `config.redisUrl`.

**Alternatives considered:**
- *Redis lists with manual sorting* — requires reading the full list and re-sorting on every insert. Worse performance, more code.
- *PostgreSQL / separate database* — adds a new dependency for a simple top-20 list. Overkill.

**Key structure:**
```
leaderboard:{mode}:scores   → sorted set (score as weight, entry ID as member)
leaderboard:entry:{id}      → hash (playerName, mode, score, stageReached, durationMs, playerCount, achievedAt)
```

Entry IDs are nanoid-generated. The sorted set stores only the ID; the hash stores the full metadata. This avoids sorted-set member size limits and makes entries independently addressable.

### 2. Trim to top 20 on write

**Decision:** After each `ZADD`, run `ZREMRANGEBYRANK` to trim entries below rank 20, and delete their associated hash keys.

**Why:** Keeps storage bounded without TTLs or scheduled cleanup. With only 20 entries per mode, the trim is effectively free.

**Alternatives considered:**
- *TTL-based expiry* — entries could expire before being displaced, leaving gaps. Confusing UX.
- *Trim on read* — wastes storage and makes reads do cleanup work.

### 3. In-memory fallback for local dev

**Decision:** Create `InMemoryLeaderboardRepository` alongside `RedisLeaderboardRepository`, following the same interface pattern as `RoomRepository`.

**Why:** Local dev typically runs without Redis. The existing codebase already uses this dual-implementation pattern (`InMemoryRoomRepository` / `RedisRoomRepository`), so this is consistent and predictable.

### 4. Score submission at match end (server-initiated)

**Decision:** The server submits the team score to the leaderboard repository immediately when a match ends (in the same code path that builds `ResultSummary`). The `match_result` message payload gains an optional `leaderboardRank` field so the client knows the placement without a second request.

**Why:** Server-authoritative scoring means the server already has the validated score. No reason to involve the client in submission. Adding `leaderboardRank` to the existing message avoids a client round-trip to check placement.

**Alternatives considered:**
- *Client submits via REST* — introduces a trust boundary (clients could submit fake scores). Rejected.
- *Separate WebSocket message for rank* — adds protocol complexity for a one-time event. Simpler to extend the existing message.

### 5. REST endpoint design

**Decision:** `GET /api/leaderboard?mode=campaign|survival` returns `LeaderboardEntry[]` (max 20). No authentication required.

**Why:** Leaderboard data is public. A single endpoint with a `mode` query param keeps the API surface minimal. Response shape matches what the client needs for rendering — no transformation required.

### 6. Leaderboard UI as a new screen (not a modal)

**Decision:** Add a full `scores` screen to the existing screen system (`landing → lobby → game → results → scores`), accessible from both the landing page and the results page.

**Why:** A full screen gives room for a professional layout with mode tabs, rank badges, and animated rows. The existing screen transition system (`showScreen()`) already handles enter/exit animations. A modal would feel cramped for 20 entries.

**Navigation flow:**
- Landing page: "Leaderboard" button → scores screen
- Results page: "High Scores" button (existing) → scores screen (upgraded from localStorage view)
- Scores screen: "Back" button → returns to previous screen

### 7. Mode tabs instead of a dropdown

**Decision:** Display campaign and survival leaderboards as tab-style toggles at the top of the scores screen.

**Why:** With only two modes, tabs are faster to switch than a dropdown and make both options immediately visible. Matches the visual style of the existing `lobby-chip` component.

## Risks / Trade-offs

**[Duplicate names]** → Players can submit the same name. Without accounts, we cannot deduplicate. Mitigation: This is acceptable for a casual arcade game. Names are display-only.

**[Redis unavailability in production]** → If Redis goes down, score submission fails silently. Mitigation: Wrap submission in try/catch so match flow is never blocked. The match result still reaches the client. Log the failure for observability.

**[Leaderboard stagnation]** → If the top 20 becomes dominated by high scores, new players never appear. Mitigation: Separate boards per mode already helps. Future enhancement could add daily/weekly boards, but that's out of scope.

**[Entry metadata size]** → Each entry hash is ~200 bytes. 40 entries total (20 per mode) = ~8 KB. Negligible Redis memory impact.

## Open Questions

_(none — scope is well-defined for a top-20 per-mode leaderboard)_
