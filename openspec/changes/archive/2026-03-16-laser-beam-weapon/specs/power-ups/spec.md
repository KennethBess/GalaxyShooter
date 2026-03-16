## MODIFIED Requirements

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
