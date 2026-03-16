## MODIFIED Requirements

### Requirement: SnapshotPlayer carries per-player active effect state
Each entry in `SnapshotState.players` SHALL include `shieldActive: boolean`, `rapidFireActive: boolean`, and `laserActive: boolean` fields indicating whether the respective timed power-up effect is currently active for that player.

#### Scenario: Active effects visible in snapshot player entry
- **WHEN** a player has `shieldMs > 0`, `rapidFireMs > 0`, or `laserMs > 0` on the server at tick time
- **THEN** the corresponding boolean in their `SnapshotPlayer` is `true`

#### Scenario: No active effects default to false
- **WHEN** a player has no active power-up effects
- **THEN** `shieldActive`, `rapidFireActive`, and `laserActive` are all `false` in their `SnapshotPlayer`
