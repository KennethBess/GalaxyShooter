## MODIFIED Requirements

### Requirement: Dedicated leaderboard screen
The client SHALL display a full-screen leaderboard view accessible from the landing page, the results screen, and the registration screen. The screen SHALL show up to 20 entries with rank number, player name, score, stage reached, time achieved, and a remove button per row.

#### Scenario: Navigate to leaderboard from registration screen
- **WHEN** the user clicks the "Leaderboard" button on the registration screen
- **THEN** the client transitions to the leaderboard screen
- **AND** fetches rankings from `GET /api/leaderboard?mode=campaign` (default mode)

#### Scenario: Return from leaderboard to registration
- **WHEN** the user clicks the "Back" button on the leaderboard screen after navigating from registration
- **THEN** the client transitions back to the registration screen
