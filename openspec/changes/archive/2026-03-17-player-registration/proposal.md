## Why

The game currently allows anyone to create or join a room without identifying themselves. We need to capture player information (full name, email, optional phone number) before gameplay so we can build a player directory, enable future communications, and export registrations for event management or marketing purposes.

## What Changes

- Add a registration gate: players must sign up before accessing Create Room / Join Room
- Capture full name (required), email address (required), and mobile/phone number (optional)
- Persist registration data server-side (Redis, matching existing infra)
- Provide a CSV export endpoint for administrators to download all registered players
- Pre-fill the "Pilot name" field from the registered full name

## Capabilities

### New Capabilities
- `player-registration`: Registration form, validation, and persistence of player profile data
- `player-export`: Admin CSV export endpoint for registered player data

### Modified Capabilities

_(none — existing specs are unaffected)_

## Impact

- **Client**: New registration screen/form added before the lobby; lobby flow gated on registration status
- **Server**: New REST endpoints for registration (`POST /register`, `GET /players/export`)
- **Shared**: New message/validation types for registration payload
- **Data**: New Redis key space for player records
- **Dependencies**: None added — uses existing Zod validation and Redis infrastructure
