## MODIFIED Requirements

### Requirement: SnapshotPlayer carries per-player active effect state
Each entry in `SnapshotState.players` SHALL include `shieldActive: boolean` and `rapidFireActive: boolean` fields indicating whether the respective timed power-up effect is currently active for that player.

#### Scenario: Active effects visible in snapshot player entry
- **WHEN** a player has `shieldMs > 0` or `rapidFireMs > 0` on the server at tick time
- **THEN** the corresponding boolean in their `SnapshotPlayer` is `true`

#### Scenario: No active effects default to false
- **WHEN** a player has no active power-up effects
- **THEN** both `shieldActive` and `rapidFireActive` are `false` in their `SnapshotPlayer`
