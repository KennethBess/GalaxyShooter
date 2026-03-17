## ADDED Requirements

### Requirement: REST endpoint to reset leaderboard
The server SHALL expose `DELETE /api/leaderboard` accepting a required `mode` query parameter (`campaign`, `survival`, or `all`). The endpoint SHALL remove all entries for the specified mode(s) and return HTTP 200 with `{ "cleared": "<mode>" }`.

#### Scenario: Reset campaign leaderboard
- **WHEN** a client sends `DELETE /api/leaderboard?mode=campaign`
- **THEN** the server removes all entries from the campaign leaderboard
- **AND** responds with HTTP 200 and `{ "cleared": "campaign" }`

#### Scenario: Reset survival leaderboard
- **WHEN** a client sends `DELETE /api/leaderboard?mode=survival`
- **THEN** the server removes all entries from the survival leaderboard
- **AND** responds with HTTP 200 and `{ "cleared": "survival" }`

#### Scenario: Reset all leaderboards
- **WHEN** a client sends `DELETE /api/leaderboard?mode=all`
- **THEN** the server removes all entries from both campaign and survival leaderboards
- **AND** responds with HTTP 200 and `{ "cleared": "all" }`

#### Scenario: Reset with invalid mode
- **WHEN** a client sends `DELETE /api/leaderboard?mode=invalid`
- **THEN** the server responds with HTTP 400 and an error message

#### Scenario: Reset an already empty leaderboard
- **WHEN** a client sends `DELETE /api/leaderboard?mode=campaign` and no scores exist
- **THEN** the server responds with HTTP 200 and `{ "cleared": "campaign" }` (no error)

### Requirement: Repository reset method
The `LeaderboardRepository` interface SHALL include a `reset(mode: GameMode | "all")` method. Both `InMemoryLeaderboardRepository` and `RedisLeaderboardRepository` SHALL implement this method.

#### Scenario: In-memory reset for single mode
- **WHEN** `reset("campaign")` is called on the in-memory repository
- **THEN** all campaign entries are removed
- **AND** survival entries remain unchanged

#### Scenario: In-memory reset for all modes
- **WHEN** `reset("all")` is called on the in-memory repository
- **THEN** all entries for every mode are removed

#### Scenario: Redis reset for single mode
- **WHEN** `reset("campaign")` is called on the Redis repository
- **THEN** all entry hash keys referenced by `leaderboard:campaign:scores` are deleted
- **AND** the `leaderboard:campaign:scores` sorted set key is deleted

#### Scenario: Redis reset for all modes
- **WHEN** `reset("all")` is called on the Redis repository
- **THEN** sorted set keys and entry hash keys for both campaign and survival are deleted

### Requirement: Reset does not block other operations
If the reset operation fails (e.g., Redis error), the error SHALL be thrown to the caller. The endpoint SHALL return HTTP 500 with an error message. Other leaderboard operations (submit, query) SHALL NOT be affected.

#### Scenario: Redis error during reset
- **WHEN** a reset is attempted and Redis returns an error
- **THEN** the endpoint responds with HTTP 500
- **AND** subsequent submit and query operations continue to function
