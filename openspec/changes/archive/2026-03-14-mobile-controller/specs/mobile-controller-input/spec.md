## ADDED Requirements

### Requirement: Controller page served at /controller
The client SHALL serve a separate HTML page at the `/controller` path. This page SHALL be a standalone entry point with no Phaser or game rendering code — only touch controls and a WebSocket connection.

#### Scenario: Controller page loads on mobile browser
- **WHEN** a user navigates to `/controller?room={roomCode}&player={playerId}` on a mobile browser
- **THEN** the page loads a lightweight touch-control interface without loading the game engine

#### Scenario: Controller page is a separate Vite entry point
- **WHEN** the client is built with Vite
- **THEN** `controller.html` is built as a separate entry point with its own minimal JS bundle

### Requirement: Virtual d-pad for directional input
The controller page SHALL display a virtual d-pad on the left side of the screen that maps to the `up`, `down`, `left`, and `right` fields of `InputState`.

#### Scenario: D-pad sends directional input on touch
- **WHEN** the user presses the "up" area of the d-pad
- **THEN** the controller sends an `input` message with `up: true` and other directions `false`
- **WHEN** the user releases the d-pad
- **THEN** the controller sends an `input` message with all directions `false`

#### Scenario: D-pad supports diagonal input
- **WHEN** the user touches between the "up" and "right" areas of the d-pad
- **THEN** the controller sends an `input` message with `up: true, right: true`

#### Scenario: D-pad provides visual feedback
- **WHEN** the user presses a direction on the d-pad
- **THEN** the pressed direction area visually highlights to confirm the touch

### Requirement: Shoot button for firing
The controller page SHALL display a large shoot button on the right side of the screen that maps to the `shoot` field of `InputState`.

#### Scenario: Shoot button sends shoot input on press
- **WHEN** the user presses the shoot button
- **THEN** the controller sends an `input` message with `shoot: true`
- **WHEN** the user releases the shoot button
- **THEN** the controller sends an `input` message with `shoot: false`

#### Scenario: Shoot button supports continuous fire
- **WHEN** the user holds the shoot button
- **THEN** the controller continuously sends `input` messages with `shoot: true` (the server handles fire rate limiting)

### Requirement: Bomb button for special attack
The controller page SHALL display a bomb button on the right side of the screen, below or beside the shoot button.

#### Scenario: Bomb button sends use_bomb message
- **WHEN** the user taps the bomb button
- **THEN** the controller sends a `use_bomb` message to the server

### Requirement: Controller page is mobile-optimized
The controller page SHALL be optimized for mobile touch interaction with full-viewport layout, no scrolling, and landscape orientation.

#### Scenario: Page fills viewport without scrolling
- **WHEN** the controller page loads on a mobile device
- **THEN** the page fills the entire viewport with no scroll bars
- **AND** the page uses `viewport` meta tag to prevent zoom and set width to device-width

#### Scenario: Page encourages landscape orientation
- **WHEN** the controller page loads on a phone held in portrait mode
- **THEN** the page displays a prompt to rotate to landscape, or renders controls in a landscape-optimized layout

### Requirement: Controller displays connection status
The controller page SHALL show the current connection state so the user knows when input is being transmitted.

#### Scenario: Connecting state shown during pairing
- **WHEN** the controller page is connecting to the server
- **THEN** the page displays a "Connecting..." status indicator

#### Scenario: Connected state shown after pairing
- **WHEN** the server confirms pairing with a `controller_paired` message
- **THEN** the page displays the player name and a "Connected" indicator
- **AND** the touch controls become active

#### Scenario: Disconnected state shown on connection loss
- **WHEN** the WebSocket connection closes unexpectedly
- **THEN** the page displays a "Disconnected" status and disables touch controls
