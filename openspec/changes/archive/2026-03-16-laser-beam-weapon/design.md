## Context

Galaxy Shooter currently has four pickup kinds (`weapon`, `bomb`, `shield`, `rapid_fire`) that modify the player's bullet-based weapon. All projectiles are discrete `RuntimeBullet` objects with swept-segment collision detection. Adding a laser beam introduces a fundamentally different weapon mechanic — a continuous area-of-effect that persists per-tick rather than spawning individual projectiles.

The server-authoritative architecture means the beam collision must run server-side. The client only needs to render the visual based on snapshot state.

## Goals / Non-Goals

**Goals:**
- Add a laser beam weapon mode as a timed power-up with distinct gameplay feel
- Beam pierces through all enemies (not consumed on hit like bullets)
- Integrate cleanly into existing pickup, snapshot, and rendering systems
- Maintain server-authoritative model — no client-side hit detection

**Non-Goals:**
- Beam steering or angled beams (vertical only in this iteration)
- Laser weapon levels or upgrades
- Enemy laser weapons
- Visual particle effects beyond a simple glowing beam

## Decisions

### 1. Beam as player state, not projectile entity
The laser beam will NOT create `RuntimeBullet` objects. Instead, it will be modeled as player state (`laserMs` timer + active flag). Each tick, if the player is in laser mode and shooting, a rectangle collision check runs against all enemies.

**Rationale:** Bullets are point-like objects with velocity that move between ticks. A beam is instantaneous and spans the full screen height — it doesn't move. Reusing `RuntimeBullet` would require hacks (zero velocity, full-height size) and break assumptions in `updateBullets`. A separate collision pass is cleaner.

**Alternative considered:** Creating a single tall bullet per tick — rejected because it would be removed by out-of-bounds checks, require special-casing in swept collision, and create snapshot bloat.

### 2. Rectangle-circle intersection for beam collision
The beam is modeled as a vertical rectangle: `x ± LASER_BEAM_HALF_WIDTH` from `player.y + PLAYER_BULLET_OFFSET_Y` to `y = 0`. Enemy collision uses circle-rectangle intersection: if the horizontal distance from the enemy center to the beam center-line is less than `LASER_BEAM_HALF_WIDTH + enemyRadius`, and the enemy's y-position is above the player, it's a hit.

**Rationale:** Simple, fast, and accurate enough for a vertical beam. No need for swept detection since the beam is instantaneous each tick.

### 3. Damage per tick with constant rate
`LASER_DAMAGE_PER_TICK` will be a constant (e.g., 3). At 30 Hz tick rate, this yields ~90 DPS. For comparison, level 3 bullets deal 12 damage per bullet at ~5.9 shots/sec = ~70 DPS but require all 3 bullets to hit. The laser rewards sustained tracking but deals slightly more total DPS to compensate for its lack of spread.

**Rationale:** Per-tick damage is simpler than a cooldown-based approach and creates the "continuous beam" feel. The constant can be tuned for balance.

### 4. Laser suppresses normal fire completely
While `laserMs > 0` and `input.shoot` is true, the normal `spawnPlayerVolley` call is skipped. The player cannot fire bullets and use the laser simultaneously.

**Rationale:** Allowing both would be overpowered and would complicate the "distinct tactical choice" design goal. The laser IS the weapon during its duration.

### 5. Snapshot communicates laser state via boolean
`SnapshotPlayer` gets a `laserActive: boolean` field (derived from `laserMs > 0`). The client uses this plus the player's position to render the beam — no separate beam entity in the snapshot.

**Rationale:** The beam geometry is fully derivable from the player's position. Sending a separate beam object would add bandwidth for no information gain. The client already knows the player's x/y.

### 6. Drop cadence uses modulo 11
Laser pickups drop when `idCounter % 11 === 0`, making them rarer than weapon (% 7) and rapid_fire (% 5) drops. The check runs after existing pickup checks, so if a weapon or rapid_fire already dropped, no laser check occurs.

**Rationale:** The laser is a powerful temporary weapon. Rarer drops maintain its excitement value and prevent it from feeling routine.

## Risks / Trade-offs

- **[Balance]** Laser DPS may be too high or too low → Mitigation: `LASER_DAMAGE_PER_TICK` and `LASER_DURATION_MS` are constants that can be tuned independently
- **[Visual clarity]** Beam might obscure enemies or pickups → Mitigation: Use semi-transparent rendering with alpha blending
- **[Multiplayer]** Multiple players with active lasers in the same room increase per-tick collision work → Mitigation: The check is O(enemies × laser_players), which is bounded by max room size (small)
- **[Snapshot size]** Adding `laserActive` boolean adds 1 byte per player per tick → Mitigation: Negligible bandwidth impact
