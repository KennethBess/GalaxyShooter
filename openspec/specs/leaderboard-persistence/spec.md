## ADDED Requirements

### Requirement: Server persists match scores to Redis
The server SHALL write the team score to a Redis sorted set when a match ends. Each game mode (campaign, survival) SHALL have its own sorted set key (`leaderboard:{mode}:scores`). Entry metadata SHALL be stored in a separate Redis hash key (`leaderboard:entry:{id}`).

#### Scenario: Score submitted after match victory
- **WHEN** a campaign match ends with outcome "victory" and a team score of 5000
- **THEN** the server writes an entry to the `leaderboard:campaign:scores` sorted set with score 5000
- **AND** stores a hash at `leaderboard:entry:{id}` containing playerName, mode, score, stageReached, durationMs, playerCount, and achievedAt

#### Scenario: Score submitted after match defeat
- **WHEN** a survival match ends with outcome "defeat" and a team score of 3200
- **THEN** the server writes an entry to the `leaderboard:survival:scores` sorted set with score 3200
- **AND** stores the entry metadata hash with the same fields as a victory

### Requirement: Leaderboard retains only top 20 entries per mode
The server SHALL trim each sorted set to the top 20 entries after every insertion. Entries displaced from the top 20 SHALL have their associated hash keys deleted.

#### Scenario: 21st entry is trimmed
- **WHEN** a new score is submitted and the sorted set already contains 20 entries
- **AND** the new score is higher than the lowest existing score
- **THEN** the lowest-ranked entry is removed from the sorted set
- **AND** the displaced entry's hash key is deleted from Redis

#### Scenario: Score too low to place
- **WHEN** a new score is submitted and it is lower than all 20 existing entries
- **THEN** the entry is added and immediately trimmed by `ZREMRANGEBYRANK`
- **AND** the associated hash key is deleted

### Requirement: Leaderboard rank returned in match result
The `match_result` server message SHALL include an optional `leaderboardRank` field (1-based integer or `null`). The server SHALL determine the rank by checking the entry's position in the sorted set after insertion.

#### Scenario: Score places on leaderboard
- **WHEN** a match ends and the team score ranks 5th on the campaign leaderboard
- **THEN** the `match_result` message payload includes `leaderboardRank: 5`

#### Scenario: Score does not place on leaderboard
- **WHEN** a match ends and the team score is not in the top 20
- **THEN** the `match_result` message payload includes `leaderboardRank: null`

### Requirement: REST endpoint returns leaderboard rankings
The server SHALL expose `GET /api/leaderboard` accepting a required `mode` query parameter (`campaign` or `survival`). The response SHALL be a JSON array of up to 20 `LeaderboardEntry` objects sorted by score descending.

#### Scenario: Fetch campaign leaderboard
- **WHEN** a client sends `GET /api/leaderboard?mode=campaign`
- **THEN** the server responds with HTTP 200 and a JSON array of `LeaderboardEntry` objects
- **AND** each entry contains: id, playerName, score, stageReached, durationMs, playerCount, achievedAt, and rank (1-based)

#### Scenario: Fetch leaderboard with invalid mode
- **WHEN** a client sends `GET /api/leaderboard?mode=invalid`
- **THEN** the server responds with HTTP 400 and an error message

#### Scenario: Fetch empty leaderboard
- **WHEN** a client sends `GET /api/leaderboard?mode=survival` and no scores exist
- **THEN** the server responds with HTTP 200 and an empty JSON array

### Requirement: In-memory fallback when Redis is unavailable
The server SHALL provide an `InMemoryLeaderboardRepository` that implements the same interface as `RedisLeaderboardRepository`. When no `REDIS_URL` is configured, the server SHALL use the in-memory implementation. The interface SHALL include `submit`, `getTopScores`, and `reset` methods.

#### Scenario: Local dev without Redis
- **WHEN** the server starts without `REDIS_URL` set
- **THEN** the in-memory leaderboard repository is used
- **AND** leaderboard operations (submit, query, reset) function identically to the Redis implementation

### Requirement: Score submission does not block match flow
Score submission to the leaderboard SHALL be non-blocking. If the submission fails (e.g., Redis error), the match result SHALL still be delivered to clients. The failure SHALL be logged.

#### Scenario: Redis write fails during submission
- **WHEN** a match ends and the Redis write for the leaderboard entry fails
- **THEN** the `match_result` message is still sent to all clients with `leaderboardRank: null`
- **AND** the error is logged

### Requirement: LeaderboardEntry shared type
The `packages/shared` module SHALL export a `LeaderboardEntry` interface containing: `id` (string), `playerName` (string), `score` (number), `mode` (GameMode), `stageReached` (number), `durationMs` (number), `playerCount` (number), `achievedAt` (number), and `rank` (number).

#### Scenario: Type is available to client and server
- **WHEN** the client or server imports from `@space-shmup/shared`
- **THEN** the `LeaderboardEntry` type is available for use
