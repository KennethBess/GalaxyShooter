## MODIFIED Requirements

### Requirement: Shield pickup grants temporary invulnerability
The server SHALL add a `shield` pickup kind. When a player collects a `shield` pickup, the server SHALL set a server-side `shieldMs` timer to `SHIELD_DURATION_MS`. While `shieldMs > 0`, the player SHALL NOT take damage from enemy bullets or enemy contact. The effect SHALL expire when `shieldMs` reaches zero. If a player collects a shield while one is already active, `shieldMs` SHALL be reset to `SHIELD_DURATION_MS` (not stacked).

#### Scenario: Shield prevents bullet damage while active
- **WHEN** a player has `shieldMs > 0` and an enemy bullet intersects their hitbox
- **THEN** the player does not lose HP and the bullet is consumed

#### Scenario: Shield prevents contact damage while active
- **WHEN** a player has `shieldMs > 0` and an enemy overlaps their hitbox
- **THEN** the enemy is destroyed and the player does not lose HP

#### Scenario: Shield expires after duration
- **WHEN** `SHIELD_DURATION_MS` milliseconds have elapsed since collection
- **THEN** `shieldMs` reaches zero and subsequent hits deal normal HP damage

#### Scenario: Shield drops on boss kill
- **WHEN** a boss enemy is killed
- **THEN** exactly one `shield` pickup is spawned at the boss's last position

#### Scenario: Collecting shield while already shielded resets duration
- **WHEN** a player with `shieldMs > 0` collects another shield pickup
- **THEN** `shieldMs` is reset to `SHIELD_DURATION_MS`
