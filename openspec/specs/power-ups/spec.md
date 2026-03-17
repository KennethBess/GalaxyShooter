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

---

### Requirement: Rapid Fire pickup temporarily reduces fire interval
The server SHALL add a `rapid_fire` pickup kind. When a player collects a `rapid_fire` pickup, the server SHALL set a server-side `rapidFireMs` timer to `RAPID_FIRE_DURATION_MS`. While `rapidFireMs > 0`, the player's effective fire interval SHALL be `PLAYER_FIRE_INTERVAL_MS / 2`. The effect SHALL expire when `rapidFireMs` reaches zero.

#### Scenario: Rapid Fire doubles shoot rate while active
- **WHEN** a player has `rapidFireMs > 0` and fires
- **THEN** the next shot becomes available after `PLAYER_FIRE_INTERVAL_MS / 2` milliseconds

#### Scenario: Rapid Fire reverts on expiry
- **WHEN** `RAPID_FIRE_DURATION_MS` milliseconds have elapsed since collection
- **THEN** `rapidFireMs` reaches zero and the fire interval returns to `PLAYER_FIRE_INTERVAL_MS`

#### Scenario: Rapid Fire drops from regular enemy kills
- **WHEN** a fighter or heavy enemy is killed and the drop roll succeeds (1-in-5 cadence)
- **THEN** a `rapid_fire` pickup is spawned at the enemy's last position

---

### Requirement: Active power-up effects broadcast in snapshot
The server SHALL include `shieldActive` and `rapidFireActive` boolean fields in each `SnapshotPlayer` entry. These SHALL reflect whether the respective effect timer is currently positive.

#### Scenario: Active shield reflected in snapshot
- **WHEN** a player's `shieldMs > 0` at snapshot time
- **THEN** their `SnapshotPlayer.shieldActive` is `true`

#### Scenario: Inactive effect reflected in snapshot
- **WHEN** a player's `shieldMs` is `0` or `rapidFireMs` is `0`
- **THEN** the corresponding snapshot boolean is `false`

---

### Requirement: Client renders pickup sprites for all pickup kinds
The client SHALL render distinct sprites for each `PickupKind` value (`weapon`, `bomb`, `shield`, `rapid_fire`, `laser`) using the positions provided in `SnapshotState.pickups`.

#### Scenario: Shield pickup sprite visible before collection
- **WHEN** a `shield` pickup exists in the snapshot
- **THEN** the client renders it at the reported position with the shield sprite

#### Scenario: Rapid Fire pickup sprite visible before collection
- **WHEN** a `rapid_fire` pickup exists in the snapshot
- **THEN** the client renders it at the reported position with the rapid_fire sprite

#### Scenario: Laser pickup sprite visible before collection
- **WHEN** a `laser` pickup exists in the snapshot
- **THEN** the client renders it at the reported position with a laser-themed sprite (e.g., "L" in red/orange)

---

### Requirement: Client displays HUD badges for active effects
The client SHALL display a visible HUD badge or icon for each active timed effect (`shieldActive`, `rapidFireActive`, `laserActive`) on the local player's HUD area. The badge SHALL disappear when the effect becomes inactive.

#### Scenario: Shield badge shown while active
- **WHEN** the local player's `SnapshotPlayer.shieldActive` is `true`
- **THEN** a shield effect badge is visible in the HUD

#### Scenario: Shield badge hidden when inactive
- **WHEN** the local player's `SnapshotPlayer.shieldActive` is `false`
- **THEN** no shield badge is displayed

#### Scenario: Laser badge shown while active
- **WHEN** the local player's `SnapshotPlayer.laserActive` is `true`
- **THEN** a laser effect badge is visible in the HUD

#### Scenario: Laser badge hidden when inactive
- **WHEN** the local player's `SnapshotPlayer.laserActive` is `false`
- **THEN** no laser badge is displayed
