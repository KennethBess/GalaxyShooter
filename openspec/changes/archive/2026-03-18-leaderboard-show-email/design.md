## Context

Registration stores email in `PlayerRecord` via `playerRepository`. When players create/join rooms, only `playerName` and `shipId` are sent. The `PlayerSlot` in a room has no email field. When a match ends, `matchService` submits scores using only data from `PlayerSlot`. The leaderboard entry has no email field.

## Goals / Non-Goals

**Goals:**
- Thread email from client registration through room join to leaderboard entry
- Store email in leaderboard entries (Redis hash + in-memory)
- Display email on the client leaderboard screen

**Non-Goals:**
- Requiring registration to play (email remains optional)
- Email validation beyond what registration already provides
- Privacy controls or email masking

## Decisions

### 1. Add email to PlayerSlot and room requests
Add optional `email` field to `CreateRoomRequest`, `JoinRoomRequest`, and `PlayerSlot`. The client sends the registered email when creating/joining a room. Unregistered players send no email (defaults to empty string).

**Alternative considered:** Looking up email from `playerRepository` at submission time using a registration ID — rejected because it adds a repository dependency to `matchService` and requires tracking registration IDs in player slots.

### 2. Add email to LeaderboardSubmission and LeaderboardEntry
The `email` field flows: client → room request → PlayerSlot → matchService → LeaderboardSubmission → LeaderboardEntry → client display.

### 3. Display email as secondary text below player name
Render the email in the existing `lb-meta` style below the player name, similar to the "Stage X · date" line. This keeps the layout compact.
