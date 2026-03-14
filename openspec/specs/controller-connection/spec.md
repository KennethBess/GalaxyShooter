## ADDED Requirements

### Requirement: Controller connect message type
The shared message protocol SHALL include a `controller_connect` client message type that allows a secondary WebSocket connection to attach as a controller for an existing player.

#### Scenario: Controller connect message structure
- **WHEN** a controller sends a `controller_connect` message
- **THEN** the message SHALL have the structure `{ type: "controller_connect", payload: { roomCode: string, playerId: string } }`

#### Scenario: Controller connect is part of ClientMessage union
- **WHEN** the shared types are compiled
- **THEN** `controller_connect` is a valid discriminant in the `ClientMessage` union type

### Requirement: Controller paired response message type
The shared message protocol SHALL include a `controller_paired` server message type sent to confirm successful controller pairing.

#### Scenario: Controller paired message structure
- **WHEN** the server sends a `controller_paired` message
- **THEN** the message SHALL have the structure `{ type: "controller_paired", payload: { playerId: string, playerName: string } }`

#### Scenario: Controller paired is part of ServerMessage union
- **WHEN** the shared types are compiled
- **THEN** `controller_paired` is a valid discriminant in the `ServerMessage` union type

### Requirement: Server accepts controller WebSocket connections
The server SHALL accept WebSocket connections from controllers via a dedicated negotiation endpoint `POST /realtime/negotiate/controller`. The endpoint SHALL validate that the specified room and player exist.

#### Scenario: Controller negotiation returns WebSocket URL
- **WHEN** a controller sends `POST /realtime/negotiate/controller` with `{ roomCode, playerId }`
- **AND** the room exists and the player is in the room
- **THEN** the server responds with a WebSocket URL for the controller to connect

#### Scenario: Controller negotiation rejects invalid room
- **WHEN** a controller sends `POST /realtime/negotiate/controller` with a non-existent room code
- **THEN** the server responds with a 404 error

#### Scenario: Controller negotiation rejects invalid player
- **WHEN** a controller sends `POST /realtime/negotiate/controller` with a valid room but non-existent player ID
- **THEN** the server responds with a 400 error

### Requirement: Server pairs controller on controller_connect message
The server SHALL register a controller connection when it receives a `controller_connect` message, mapping the connection to the target player ID.

#### Scenario: Successful controller pairing
- **WHEN** a controller WebSocket sends a `controller_connect` message with a valid room code and player ID
- **THEN** the server registers the connection as a controller for that player
- **AND** the server sends a `controller_paired` message back to the controller with the player's name

#### Scenario: Controller pairing fails for invalid player
- **WHEN** a controller WebSocket sends a `controller_connect` message with an invalid player ID
- **THEN** the server sends an `error` message and closes the connection

### Requirement: Server routes controller input to target player
The server SHALL accept `input` messages from paired controller connections and write the payload to the target player's entry in `runtime.inputs`, identically to keyboard input.

#### Scenario: Controller input updates player input state
- **WHEN** a paired controller sends an `input` message with `{ up: true, shoot: true }`
- **THEN** the server sets `runtime.inputs.set(targetPlayerId, { up: true, down: false, left: false, right: false, shoot: true })`

#### Scenario: Controller input is indistinguishable from keyboard input
- **WHEN** the server tick loop reads `runtime.inputs.get(playerId)`
- **THEN** input from a controller is the same `InputState` shape as input from a keyboard connection

### Requirement: Server routes controller use_bomb to target player
The server SHALL accept `use_bomb` messages from paired controller connections and queue the bomb for the target player.

#### Scenario: Controller bomb triggers player bomb
- **WHEN** a paired controller sends a `use_bomb` message
- **THEN** the server queues a bomb for the target player, identical to a keyboard-triggered bomb

### Requirement: Controller disconnect does not remove player
When a controller WebSocket disconnects, the server SHALL remove the controller mapping but SHALL NOT remove the player from the room or affect the player's game state.

#### Scenario: Controller disconnects during match
- **WHEN** a paired controller's WebSocket connection closes
- **THEN** the server removes the controller mapping
- **AND** the player remains in the match with their current state
- **AND** the player can still receive keyboard input from the main client

#### Scenario: Player disconnect is independent of controller
- **WHEN** the main client disconnects
- **THEN** the normal player disconnect/reconnect flow applies regardless of whether a controller is connected

### Requirement: Controller works with both transport modes
The controller connection flow SHALL work with both direct WebSocket and Azure Web PubSub transport modes using the same negotiation pattern.

#### Scenario: Controller connects via direct WebSocket
- **WHEN** the server is running in direct WebSocket mode
- **THEN** the controller negotiation endpoint returns a direct WebSocket URL
- **AND** the controller connects and pairs successfully

#### Scenario: Controller connects via Web PubSub
- **WHEN** the server is running in Azure Web PubSub mode
- **THEN** the controller negotiation endpoint returns a Web PubSub URL
- **AND** the controller connects and pairs successfully
