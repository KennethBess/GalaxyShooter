## ADDED Requirements

### Requirement: Input repeat interval matches server tick rate
The client SHALL re-send held input state at an interval no greater than one server tick (~33 ms) so that direction changes reach the server within one tick.

#### Scenario: Rapid direction reversal reaches server promptly
- **WHEN** the player releases Left and presses Right within a single server tick (33 ms)
- **THEN** the new Right input SHALL be sent to the server within 33 ms of the key change

#### Scenario: Held input is re-sent every tick
- **WHEN** the player holds a direction key continuously
- **THEN** the client SHALL re-send the input state at most every 33 ms

### Requirement: Drift correction begins at a lower threshold
The client SHALL begin correcting prediction drift for the self-player when the distance between the predicted position and the server-authoritative position exceeds 40 px (instead of the previous 96 px).

#### Scenario: Small drift triggers correction
- **WHEN** the self-player's predicted position drifts 50 px from the last server snapshot position
- **THEN** the client SHALL apply drift-correction lerp to move toward the server position

#### Scenario: No correction for negligible drift
- **WHEN** the self-player's predicted position drifts less than 40 px from the server position
- **THEN** the client SHALL trust the prediction without correction

### Requirement: Drift correction lerp is fast enough to feel responsive
The client SHALL use a drift-correction lerp factor of at least 0.25 per frame for the self-player, so that prediction errors converge visibly within ~150 ms.

#### Scenario: Correction converges within 150 ms
- **WHEN** the self-player has a 100 px prediction drift
- **THEN** the drift SHALL be reduced to under 20 px within 150 ms (approximately 9 frames at 60 FPS)

### Requirement: Server-side input handling is unchanged
The server SHALL continue to process `InputState` payloads identically. No changes to the tick rate, movement physics, or snapshot broadcast.

#### Scenario: Server processes input as before
- **WHEN** the server receives an `InputState` message
- **THEN** it SHALL store and apply it on the next tick exactly as it does today
