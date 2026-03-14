## ADDED Requirements

### Requirement: Player bullet collision uses swept segment detection
The server SHALL detect bullet-vs-enemy collisions by computing the minimum distance from the bullet's swept path segment (previous position to current position) to the enemy center, rather than checking the bullet's current position alone. A hit SHALL be registered when this minimum distance is less than or equal to `bullet.radius + enemy.radius`.

#### Scenario: Edge-grazing bullet registers a hit
- **WHEN** a player bullet's path segment passes within `bullet.radius + enemy.radius` of an enemy center, even if neither the bullet's start nor end position is within that distance
- **THEN** the hit is registered and the bullet is consumed

#### Scenario: Bullet clearly missing enemy does not register
- **WHEN** a player bullet's entire path segment remains farther than `bullet.radius + enemy.radius` from an enemy center
- **THEN** no hit is registered and the bullet continues on its path

#### Scenario: Direct center hit still registers
- **WHEN** a player bullet's current position is within `bullet.radius + enemy.radius` of an enemy center (legacy point-inside case)
- **THEN** the hit is registered as before

---

### Requirement: RuntimeBullet tracks previous tick position
The server SHALL store `prevX` and `prevY` on each `RuntimeBullet`, updated at the start of each physics tick to the bullet's position before velocity integration. At bullet spawn, `prevX` and `prevY` SHALL equal the bullet's initial `x` and `y`.

#### Scenario: prevX/prevY initialized at spawn
- **WHEN** a new bullet is created (player volley or enemy fire)
- **THEN** `prevX` equals the bullet's initial `x` and `prevY` equals the bullet's initial `y`

#### Scenario: prevX/prevY updated before position integration
- **WHEN** the physics tick runs `updateBullets`
- **THEN** each bullet's `prevX`/`prevY` is set to its `x`/`y` before the velocity step is applied

---

### Requirement: Player bullet radius is 8
The `PLAYER_BULLET_RADIUS` constant SHALL be `8` (changed from `5`) to better match the visual size of the rendered bullet circle and reduce perceived near-miss discrepancies.

#### Scenario: Bullet radius constant is 8
- **WHEN** `PLAYER_BULLET_RADIUS` is read from `gameTypes.ts`
- **THEN** its value is `8`
