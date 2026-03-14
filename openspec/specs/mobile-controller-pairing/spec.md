## ADDED Requirements

### Requirement: QR code displayed in lobby screen
The main client SHALL display a QR code in the lobby screen that encodes the controller URL for the local player. The QR code SHALL be visible to all players who have joined the room.

#### Scenario: QR code appears after joining a room
- **WHEN** the local player is in the lobby screen with a valid room code and player ID
- **THEN** a QR code is rendered as an inline SVG encoding the URL `https://{host}/controller?room={roomCode}&player={playerId}`

#### Scenario: QR code updates when room context changes
- **WHEN** the player leaves and joins a different room
- **THEN** the QR code updates to reflect the new room code and player ID

### Requirement: QR code accessible during gameplay
The main client SHALL provide a way to access the controller QR code during an active match, so players can pair a controller mid-game.

#### Scenario: QR code accessible via overlay during match
- **WHEN** the game screen is active and the player activates the QR code overlay
- **THEN** the controller QR code is displayed without pausing the game

### Requirement: Controller URL scheme
The controller URL SHALL follow the format `https://{host}/controller?room={roomCode}&player={playerId}`, where `{host}` is the current page origin, `{roomCode}` is the active room code, and `{playerId}` is the local player's ID.

#### Scenario: Controller URL contains correct parameters
- **WHEN** the QR code is generated for a player in room "ABCDE" with player ID "uuid-123"
- **THEN** the encoded URL contains query parameters `room=ABCDE` and `player=uuid-123`

#### Scenario: Controller URL uses current page origin
- **WHEN** the game is hosted at `https://galaxy-shooter.example.com`
- **THEN** the controller URL starts with `https://galaxy-shooter.example.com/controller`

### Requirement: QR code generated client-side
The client SHALL generate QR codes using a client-side library that outputs SVG. No server round-trip SHALL be required for QR code generation.

#### Scenario: QR code renders without server call
- **WHEN** the lobby screen renders the QR code
- **THEN** the QR code SVG is generated entirely in the browser using the `qrcode` library
- **AND** no HTTP request is made to the server for QR generation
