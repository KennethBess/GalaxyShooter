### Requirement: Players have a health pool
Each player SHALL have an `hp` field (current health) and `maxHp` field (maximum health). `maxHp` SHALL be defined by the constant `PLAYER_MAX_HP` (default: 3). On spawn and respawn, `hp` SHALL be set to `maxHp`.

#### Scenario: Player spawns with full health
- **WHEN** a player spawns or respawns into a match
- **THEN** their `hp` is equal to `maxHp` (3)

#### Scenario: Player health cannot exceed maxHp
- **WHEN** any game logic would set `hp` above `maxHp`
- **THEN** `hp` is clamped to `maxHp`

---

### Requirement: Enemy contact deals damage instead of instant kill
When an enemy overlaps a player's hitbox and the player is not shielded or invulnerable, the server SHALL reduce the player's `hp` by 1 and grant a brief invulnerability window (`DAMAGE_INVULN_MS`, default: 1000ms). The enemy is destroyed as before.

#### Scenario: Enemy contact reduces HP by 1
- **WHEN** an unshielded player with `hp > 1` collides with an enemy
- **THEN** the player's `hp` decreases by 1, the enemy is destroyed, and the player gains `DAMAGE_INVULN_MS` of invulnerability

#### Scenario: Enemy contact at 1 HP kills the player
- **WHEN** an unshielded player with `hp == 1` collides with an enemy
- **THEN** the player's `hp` reaches 0, the player dies, and standard death/respawn logic applies

#### Scenario: Damage invulnerability prevents stacking
- **WHEN** a player is within the `DAMAGE_INVULN_MS` window after taking damage
- **THEN** additional enemy contact does not reduce `hp`

---

### Requirement: Enemy bullets deal damage instead of instant kill
When an enemy bullet intersects a player's hitbox and the player is not shielded or invulnerable, the server SHALL reduce the player's `hp` by 1 and grant `DAMAGE_INVULN_MS` of invulnerability. The bullet is consumed.

#### Scenario: Bullet hit reduces HP by 1
- **WHEN** an unshielded player with `hp > 1` is hit by an enemy bullet
- **THEN** the player's `hp` decreases by 1, the bullet is consumed, and the player gains `DAMAGE_INVULN_MS` of invulnerability

#### Scenario: Bullet hit at 1 HP kills the player
- **WHEN** an unshielded player with `hp == 1` is hit by an enemy bullet
- **THEN** the player's `hp` reaches 0, the player dies, and standard death/respawn logic applies
