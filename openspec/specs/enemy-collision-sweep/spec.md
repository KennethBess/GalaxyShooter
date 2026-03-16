## ADDED Requirements

### Requirement: Enemy bullet collision uses swept segment detection
The server SHALL detect enemy-bullet-vs-player collisions by computing the minimum distance from the bullet's swept path segment (previous position to current position) to the player center, rather than checking the bullet's current position alone. A hit SHALL be registered when this minimum distance is less than or equal to `bullet.radius + PLAYER_HITBOX_RADIUS`.

#### Scenario: Enemy bullet edge-graze registers a hit
- **WHEN** an enemy bullet's path segment passes within `bullet.radius + PLAYER_HITBOX_RADIUS` of a player center, even if neither the bullet's start nor end position is within that distance
- **THEN** the hit is registered and the bullet is consumed

#### Scenario: Enemy bullet clearly missing player does not register
- **WHEN** an enemy bullet's entire path segment remains farther than `bullet.radius + PLAYER_HITBOX_RADIUS` from a player center
- **THEN** no hit is registered and the bullet continues on its path

---

### Requirement: RuntimeEnemy tracks previous tick position
The server SHALL store `prevX` and `prevY` on each `RuntimeEnemy`, updated at the start of each physics tick to the enemy's position before velocity integration. At enemy spawn, `prevX` and `prevY` SHALL equal the enemy's initial `x` and `y`.

#### Scenario: Enemy prevX/prevY initialized at spawn
- **WHEN** a new enemy is created via `createEnemy`
- **THEN** `prevX` equals the enemy's initial `x` and `prevY` equals the enemy's initial `y`

#### Scenario: Enemy prevX/prevY updated before position integration
- **WHEN** the physics tick runs `updateEnemies`
- **THEN** each enemy's `prevX`/`prevY` is set to its `x`/`y` before the velocity step is applied

---

### Requirement: Enemy body collision uses swept segment detection
The server SHALL detect enemy-body-vs-player collisions by computing the minimum distance from the enemy's swept path segment (previous position to current position) to the player center, rather than checking the enemy's current position alone. A hit SHALL be registered when this minimum distance is less than or equal to `enemy.radius + PLAYER_HITBOX_RADIUS`.

#### Scenario: Fast-moving kamikaze edge-graze registers a hit
- **WHEN** a kamikaze enemy's path segment passes within `enemy.radius + PLAYER_HITBOX_RADIUS` of a player center, even if neither the enemy's start nor end position is within that distance
- **THEN** the body collision is registered, the enemy is killed, and the player is hit

#### Scenario: Slow-moving enemy clearly missing player does not register
- **WHEN** an enemy's entire path segment remains farther than `enemy.radius + PLAYER_HITBOX_RADIUS` from a player center
- **THEN** no body collision is registered
