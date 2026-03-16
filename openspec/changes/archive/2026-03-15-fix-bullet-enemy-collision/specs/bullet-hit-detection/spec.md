## MODIFIED Requirements

### Requirement: Player bullet collision uses swept segment detection
The server SHALL detect bullet-vs-enemy collisions by computing the minimum distance from the bullet's swept path segment (previous position to current position) to the enemy center, rather than checking the bullet's current position alone. A hit SHALL be registered when this minimum distance is less than or equal to `bullet.radius + enemy.radius`. The same swept segment technique SHALL also be used for enemy bullet-vs-player collisions using the enemy bullet's swept path segment and the player center.

#### Scenario: Edge-grazing bullet registers a hit
- **WHEN** a player bullet's path segment passes within `bullet.radius + enemy.radius` of an enemy center, even if neither the bullet's start nor end position is within that distance
- **THEN** the hit is registered and the bullet is consumed

#### Scenario: Bullet clearly missing enemy does not register
- **WHEN** a player bullet's entire path segment remains farther than `bullet.radius + enemy.radius` from an enemy center
- **THEN** no hit is registered and the bullet continues on its path

#### Scenario: Direct center hit still registers
- **WHEN** a player bullet's current position is within `bullet.radius + enemy.radius` of an enemy center (legacy point-inside case)
- **THEN** the hit is registered as before

#### Scenario: Enemy bullet edge-graze registers via swept detection
- **WHEN** an enemy bullet's path segment passes within `bullet.radius + PLAYER_HITBOX_RADIUS` of a player center
- **THEN** the hit is registered and the bullet is consumed
