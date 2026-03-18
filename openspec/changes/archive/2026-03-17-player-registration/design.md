## Context

The game currently has no player identity system — anyone can type a pilot name and create/join a room. The existing architecture uses Redis for room and leaderboard persistence, Express for REST endpoints, and a Phaser-based client with screen-based navigation (lobby, game, results, scores, settings).

## Goals / Non-Goals

**Goals:**
- Gate lobby access behind a registration form
- Persist player records in Redis with full name, email, optional phone
- Provide CSV export of all registrations via a server endpoint
- Pre-fill pilot name from registration data

**Non-Goals:**
- Authentication/password system — this is registration only, not login
- Admin UI for viewing registrations — CSV export is sufficient
- Email verification or phone validation (beyond format checks)
- Rate limiting the export endpoint with auth tokens (simple endpoint for now)

## Decisions

### 1. Registration token via player ID in localStorage

Store the player's Redis-generated ID in `localStorage` as the registration token. On app load, check for this key — if present and valid, skip to lobby.

**Why over cookies/sessions:** Matches existing client-side state pattern (no server sessions today). Simple, no additional auth middleware needed.

**Alternative considered:** Server-issued JWT — rejected as over-engineered for a registration gate with no sensitive data.

### 2. Redis Hash per player with a Set index

Store each player as a Redis Hash at `player:{id}` with fields: `fullName`, `email`, `phone`, `registeredAt`. Maintain a Redis Set `players:all` containing all player IDs for enumeration during export. Add a secondary index `players:email:{email}` → `{id}` for duplicate detection.

**Why over a single JSON blob:** Hash fields are individually readable, Set gives O(1) membership checks, and the pattern matches existing `leaderboardRepository.ts` conventions.

### 3. New `playerRepository.ts` module

Create a dedicated repository following the same pattern as `leaderboardRepository.ts` — receives a `RedisClientType` from the factory, exposes `register()`, `getById()`, `getByEmail()`, and `getAll()`.

### 4. Client-side registration screen

Add a `"register"` screen to the existing screen state machine. The app starts on `"register"` if no token exists in localStorage, otherwise starts on `"lobby"`. The registration form uses the same styling as the existing lobby UI.

### 5. CSV generation on the server

Build CSV in-memory on each export request using simple string concatenation (no library needed for this scale). Properly escape fields per RFC 4180.

**Alternative considered:** Streaming CSV — unnecessary given expected data volumes (hundreds to low thousands of players).

## Risks / Trade-offs

- **[No auth on export]** → The `/players/export` endpoint has no authentication. Acceptable for a game registration list; can add API key protection later if needed.
- **[localStorage token loss]** → If a player clears browser data, they lose their token. The duplicate-email check means re-registering with the same email returns the existing record, so no data loss occurs.
- **[Redis volatility]** → Player data shares Redis with rooms/leaderboard. If Redis is flushed, registrations are lost. Mitigation: the CSV export provides a backup mechanism.
