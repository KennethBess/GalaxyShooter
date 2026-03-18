## MODIFIED Requirements

### Requirement: Server persists match scores to Redis
The server SHALL write the team score to a Redis sorted set when a match ends. Each game mode (campaign, survival) SHALL have its own sorted set key (`leaderboard:{mode}:scores`). Entry metadata SHALL be stored in a separate Redis hash key (`leaderboard:entry:{id}`), including the host player's registered email.

#### Scenario: Score submitted with email
- **WHEN** a match ends and the host player has a registered email
- **THEN** the entry metadata hash includes the `email` field

#### Scenario: Score submitted without email
- **WHEN** a match ends and the host player has no registered email (unregistered player)
- **THEN** the entry metadata hash stores `email` as an empty string

### Requirement: LeaderboardEntry shared type
The `packages/shared` module SHALL export a `LeaderboardEntry` interface containing: `id` (string), `playerName` (string), `email` (string), `score` (number), `mode` (GameMode), `stageReached` (number), `durationMs` (number), `playerCount` (number), `achievedAt` (number), and `rank` (number).

#### Scenario: Type is available to client and server
- **WHEN** the client or server imports from `@space-shmup/shared`
- **THEN** the `LeaderboardEntry` type includes the `email` field
