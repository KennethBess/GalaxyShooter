### Requirement: Arrow keys move the player ship
The client SHALL accept arrow keys (Up, Down, Left, Right) as movement input, producing the same `InputState` values as the corresponding WASD keys (W, S, A, D).

#### Scenario: Arrow key produces movement
- **WHEN** the player presses the Right arrow key
- **THEN** the `InputState.right` boolean SHALL be `true`, identical to pressing the D key

#### Scenario: Arrow keys and WASD work simultaneously
- **WHEN** the player holds the W key and the Right arrow key at the same time
- **THEN** `InputState.up` SHALL be `true` (from W) and `InputState.right` SHALL be `true` (from Right arrow)

### Requirement: Arrow-Up no longer triggers shooting
The `altShoot` binding currently mapped to `KeyCodes.UP` (arrow up) SHALL be removed or remapped so that the Up arrow key is exclusively used for upward movement.

#### Scenario: Arrow-Up moves the ship upward
- **WHEN** the player presses the Up arrow key
- **THEN** `InputState.up` SHALL be `true` and `InputState.shoot` SHALL remain `false`

#### Scenario: Spacebar remains the primary shoot key
- **WHEN** the player presses the Spacebar
- **THEN** `InputState.shoot` SHALL be `true`

### Requirement: No changes to server input protocol
The `InputState` interface and `PlayerInputMessage` type SHALL remain unchanged. Arrow key support is a client-only key-binding change.

#### Scenario: Server receives identical input payloads
- **WHEN** a player moves using arrow keys
- **THEN** the server SHALL receive the same `{ up, down, left, right, shoot }` payload as when WASD is used
