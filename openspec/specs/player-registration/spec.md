## Purpose

Player registration gate — captures player identity (name, email, optional phone) before allowing access to the game lobby.

## Requirements

### Requirement: Registration form gate
The system SHALL display a registration form before a player can access the lobby (Create Room / Join Room). Players who have not registered MUST NOT be able to create or join rooms.

#### Scenario: Unregistered player visits the app
- **WHEN** a player opens the app without a valid registration token
- **THEN** the system displays the registration form instead of the lobby

#### Scenario: Registered player visits the app
- **WHEN** a player opens the app with a valid registration token stored in localStorage
- **THEN** the system displays the lobby directly, skipping the registration form

### Requirement: Registration data capture
The registration form SHALL capture the following fields:
- **Full name** (required, non-empty string, max 100 characters)
- **Email address** (required, valid email format)
- **Mobile/phone number** (optional, string, max 20 characters)

#### Scenario: Valid registration submission
- **WHEN** a player submits the form with a valid full name and email address
- **THEN** the system persists the registration, stores a registration token in localStorage, and navigates to the lobby

#### Scenario: Missing required fields
- **WHEN** a player submits the form with an empty full name or invalid email
- **THEN** the system displays inline validation errors and does not submit

#### Scenario: Optional phone number omitted
- **WHEN** a player submits the form without a phone number
- **THEN** the registration succeeds with the phone field stored as empty/null

### Requirement: Registration persistence
The server SHALL persist player registrations in Redis. Each registration record MUST include: id, fullName, email, phone (nullable), and registeredAt timestamp.

#### Scenario: Successful server-side persistence
- **WHEN** the server receives a valid `POST /register` request
- **THEN** it creates a new player record in Redis and returns the player id as the registration token

#### Scenario: Duplicate email registration
- **WHEN** a player registers with an email that already exists
- **THEN** the server returns the existing player's registration token (idempotent — does not create a duplicate)

### Requirement: Pilot name pre-fill
The lobby SHALL pre-fill the "Pilot name" input with the registered player's full name.

#### Scenario: Lobby loads after registration
- **WHEN** a registered player reaches the lobby
- **THEN** the "Pilot name" field is pre-filled with their registered full name and remains editable
