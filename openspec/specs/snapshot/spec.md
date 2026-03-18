### Requirement: SnapshotPlayer carries per-player active effect state
Each entry in `SnapshotState.players` SHALL include `shieldActive: boolean`, `rapidFireActive: boolean`, `laserActive: boolean`, `hp: number`, `maxHp: number`, and `shieldRemainingMs: number` fields. The effect booleans indicate whether the respective timed power-up is currently active. The `hp` and `maxHp` fields reflect the player's current and maximum health. The `shieldRemainingMs` field contains the milliseconds of shield duration remaining (0 when inactive).

#### Scenario: Active effects visible in snapshot player entry
- **WHEN** a player has `shieldMs > 0`, `rapidFireMs > 0`, or `laserMs > 0` on the server at tick time
- **THEN** the corresponding boolean in their `SnapshotPlayer` is `true`

#### Scenario: No active effects default to false
- **WHEN** a player has no active power-up effects
- **THEN** `shieldActive`, `rapidFireActive`, and `laserActive` are all `false` in their `SnapshotPlayer`

#### Scenario: Health fields included in snapshot
- **WHEN** the server builds a snapshot for a player
- **THEN** `hp` reflects the player's current health and `maxHp` reflects `PLAYER_MAX_HP`

#### Scenario: Shield remaining duration included in snapshot
- **WHEN** a player has `shieldMs > 0` at snapshot time
- **THEN** `shieldRemainingMs` equals the current value of `shieldMs`

#### Scenario: Shield remaining zero when inactive
- **WHEN** a player has `shieldMs == 0` at snapshot time
- **THEN** `shieldRemainingMs` is `0`
