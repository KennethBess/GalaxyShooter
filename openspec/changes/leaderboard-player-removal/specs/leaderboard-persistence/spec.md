## MODIFIED Requirements

### Requirement: In-memory fallback when Redis is unavailable
The server SHALL provide an `InMemoryLeaderboardRepository` that implements the same interface as `RedisLeaderboardRepository`. When no `REDIS_URL` is configured, the server SHALL use the in-memory implementation. Both implementations SHALL support `deleteEntry(id)` to remove a single entry.

#### Scenario: Local dev without Redis
- **WHEN** the server starts without `REDIS_URL` set
- **THEN** the in-memory leaderboard repository is used
- **AND** leaderboard operations (submit, query, delete) function identically to the Redis implementation

#### Scenario: Delete entry via in-memory repository
- **WHEN** `deleteEntry(id)` is called on the in-memory repository with a valid ID
- **THEN** the entry is removed from the in-memory store
- **AND** the method returns `true`

#### Scenario: Delete non-existent entry via in-memory repository
- **WHEN** `deleteEntry(id)` is called on the in-memory repository with an ID that does not exist
- **THEN** the method returns `false`
