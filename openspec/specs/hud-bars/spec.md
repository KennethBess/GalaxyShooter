### Requirement: Health bar displays current HP
The client SHALL render a horizontal health bar in the HUD area showing the local player's current `hp` relative to `maxHp`. The bar SHALL use filled segments or a continuous fill.

#### Scenario: Full health display
- **WHEN** the local player's `hp` equals `maxHp`
- **THEN** the health bar is fully filled and colored green

#### Scenario: Partial health display
- **WHEN** the local player's `hp` is between 1 and `maxHp - 1`
- **THEN** the health bar fill is proportional to `hp / maxHp` and transitions toward red as HP decreases

#### Scenario: Dead player hides health bar
- **WHEN** the local player's `alive` is `false`
- **THEN** the health bar is hidden or visually dimmed

---

### Requirement: Shield bar displays remaining shield duration
The client SHALL render a shield bar (visually distinct from the health bar) showing the local player's `shieldRemainingMs` relative to `SHIELD_DURATION_MS`. The bar SHALL drain smoothly between snapshots using client-side interpolation.

#### Scenario: Shield bar appears when shield is active
- **WHEN** the local player's `shieldRemainingMs` is greater than 0
- **THEN** a shield bar is visible in the HUD, filled proportionally to `shieldRemainingMs / SHIELD_DURATION_MS`

#### Scenario: Shield bar drains between snapshots
- **WHEN** a snapshot arrives with `shieldRemainingMs` and the next snapshot has not yet arrived
- **THEN** the shield bar fill decreases smoothly using elapsed time to estimate remaining duration

#### Scenario: Shield bar hidden when inactive
- **WHEN** the local player's `shieldRemainingMs` is 0
- **THEN** no shield bar is displayed

---

### Requirement: Health bar flashes on damage
The client SHALL briefly flash or highlight the health bar when the local player's `hp` decreases between consecutive snapshots, providing immediate visual feedback.

#### Scenario: Damage flash triggers on HP decrease
- **WHEN** the local player's `hp` in the current snapshot is less than in the previous snapshot
- **THEN** the health bar flashes white or red for approximately 200ms

#### Scenario: No flash on respawn HP restore
- **WHEN** the local player transitions from `alive: false` to `alive: true` with full `hp`
- **THEN** no damage flash occurs

---

### Requirement: HUD bars positioned consistently
The health and shield bars SHALL be rendered at a fixed screen position in the HUD layer (top-left area, below the existing score/stage text). They SHALL remain visible regardless of camera or game object positions.

#### Scenario: Bars visible during gameplay
- **WHEN** a match is in progress and the local player is alive
- **THEN** health bar (and shield bar if active) are visible at their fixed HUD position

#### Scenario: Bars render above game objects
- **WHEN** game objects (enemies, bullets, pickups) overlap the bar position
- **THEN** the HUD bars render on top of all game objects
