## MODIFIED Requirements

### Requirement: In-memory fallback when Redis is unavailable
The server SHALL provide an `InMemoryLeaderboardRepository` that implements the same interface as `RedisLeaderboardRepository`. When no `REDIS_URL` is configured, the server SHALL use the in-memory implementation. The interface SHALL include `submit`, `getTopScores`, and `reset` methods.

#### Scenario: Local dev without Redis
- **WHEN** the server starts without `REDIS_URL` set
- **THEN** the in-memory leaderboard repository is used
- **AND** leaderboard operations (submit, query, reset) function identically to the Redis implementation
