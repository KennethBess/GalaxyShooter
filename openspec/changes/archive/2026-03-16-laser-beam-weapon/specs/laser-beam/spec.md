## ADDED Requirements

### Requirement: Laser beam pickup grants timed laser weapon mode
The server SHALL add a `laser` pickup kind. When a player collects a `laser` pickup, the server SHALL set a server-side `laserMs` timer to `LASER_DURATION_MS` (6000). While `laserMs > 0`, the player SHALL be in laser mode. The effect SHALL expire when `laserMs` reaches zero, reverting the player to their previous weapon.

#### Scenario: Collecting laser pickup activates laser mode
- **WHEN** a player collects a `laser` pickup
- **THEN** `laserMs` is set to `LASER_DURATION_MS` and the player enters laser mode

#### Scenario: Laser mode expires after duration
- **WHEN** `LASER_DURATION_MS` milliseconds have elapsed since collection
- **THEN** `laserMs` reaches zero and the player reverts to normal bullet fire at their current weapon level

#### Scenario: Collecting laser while already active resets timer
- **WHEN** a player in laser mode collects another `laser` pickup
- **THEN** `laserMs` is reset to `LASER_DURATION_MS`

---

### Requirement: Laser mode suppresses normal bullet fire
While a player is in laser mode (`laserMs > 0`), the server SHALL NOT spawn bullet projectiles for that player's shoot input. The laser beam SHALL be the player's sole weapon during this mode.

#### Scenario: No bullets spawned during laser mode
- **WHEN** a player has `laserMs > 0` and `input.shoot` is true
- **THEN** no `RuntimeBullet` objects are created for that player

#### Scenario: Bullets resume after laser expires
- **WHEN** a player's `laserMs` reaches zero and `input.shoot` is true
- **THEN** normal bullet spawning resumes according to the player's current weapon level

---

### Requirement: Laser beam deals damage per tick to intersecting enemies
While a player is in laser mode and `input.shoot` is true, the server SHALL perform a beam-vs-enemy collision check each tick. The beam SHALL extend vertically from the player's position (`player.y + PLAYER_BULLET_OFFSET_Y`) to `y = 0` (top of screen) with a fixed half-width of `LASER_BEAM_HALF_WIDTH` (12 pixels). Every enemy whose bounding circle intersects the beam rectangle SHALL receive `LASER_DAMAGE_PER_TICK` damage each tick.

#### Scenario: Enemy fully inside beam takes damage
- **WHEN** an enemy's center is within `LASER_BEAM_HALF_WIDTH` of the player's x-position and the player is firing in laser mode
- **THEN** the enemy receives `LASER_DAMAGE_PER_TICK` damage that tick

#### Scenario: Enemy partially overlapping beam takes damage
- **WHEN** an enemy's bounding circle overlaps the beam rectangle (enemy center distance to beam center-line is less than `LASER_BEAM_HALF_WIDTH + enemyRadius`)
- **THEN** the enemy receives `LASER_DAMAGE_PER_TICK` damage that tick

#### Scenario: Enemy outside beam takes no damage
- **WHEN** an enemy's bounding circle does not intersect the beam rectangle
- **THEN** the enemy receives no laser damage

#### Scenario: Beam inactive when not shooting
- **WHEN** a player is in laser mode but `input.shoot` is false
- **THEN** no beam collision checks occur and no damage is dealt

#### Scenario: Multiple enemies in beam all take damage
- **WHEN** multiple enemies intersect the beam simultaneously
- **THEN** each enemy independently receives `LASER_DAMAGE_PER_TICK` damage (beam pierces through all enemies)

---

### Requirement: Laser pickup drops from enemy kills
The server SHALL integrate laser pickup drops into the existing `maybeDropPickup` logic. Laser pickups SHALL drop on a cadence-based roll similar to other pickups, using a modulo check on the kill counter.

#### Scenario: Laser pickup drops on cadence
- **WHEN** a regular enemy is killed and the drop cadence check for laser succeeds
- **THEN** a `laser` pickup is spawned at the enemy's last position with `PICKUP_DROP_SPEED` velocity

#### Scenario: Laser pickup does not drop when cadence misses
- **WHEN** a regular enemy is killed and the drop cadence check for laser does not succeed
- **THEN** no `laser` pickup is spawned (other pickup types may still drop per their own cadence)

---

### Requirement: Client renders laser beam visual
The client SHALL render a visible beam effect when the local or remote player is in laser mode and shooting. The beam SHALL be a vertical rectangle or line from the player's position to the top of the screen with a glowing visual effect.

#### Scenario: Beam visible while firing in laser mode
- **WHEN** a player's snapshot shows `laserActive: true` and `input.shoot` is true (or inferred from snapshot)
- **THEN** the client renders a beam graphic from the player's position upward

#### Scenario: Beam not visible when not shooting
- **WHEN** a player's snapshot shows `laserActive: true` but the beam is not active (player not shooting)
- **THEN** no beam graphic is rendered

---

### Requirement: Client displays laser HUD badge
The client SHALL display a "LASER" HUD badge when the local player is in laser mode, consistent with the existing shield and rapid fire badge styling.

#### Scenario: Laser badge shown while active
- **WHEN** the local player's `SnapshotPlayer.laserActive` is `true`
- **THEN** a laser effect badge is visible in the HUD

#### Scenario: Laser badge hidden when inactive
- **WHEN** the local player's `SnapshotPlayer.laserActive` is `false`
- **THEN** no laser badge is displayed
