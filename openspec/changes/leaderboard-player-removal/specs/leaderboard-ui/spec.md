## MODIFIED Requirements

### Requirement: Dedicated leaderboard screen
The client SHALL display a full-screen leaderboard view accessible from the landing page and the results screen. The screen SHALL show up to 20 entries with rank number, player name, score, stage reached, time achieved, and a remove button per row.

#### Scenario: Navigate to leaderboard from landing page
- **WHEN** the user clicks the "Leaderboard" button on the landing page
- **THEN** the client transitions to the leaderboard screen
- **AND** fetches rankings from `GET /api/leaderboard?mode=campaign` (default mode)

#### Scenario: Navigate to leaderboard from results screen
- **WHEN** the user clicks the "High Scores" button on the results screen
- **THEN** the client transitions to the leaderboard screen
- **AND** the mode tab is pre-selected to match the mode of the just-completed match

#### Scenario: Return from leaderboard
- **WHEN** the user clicks the "Back" button on the leaderboard screen
- **THEN** the client transitions back to the previous screen (landing or results)

#### Scenario: Each entry row includes a remove action
- **WHEN** the leaderboard screen renders entries
- **THEN** each row includes a remove button styled consistently with the space theme
