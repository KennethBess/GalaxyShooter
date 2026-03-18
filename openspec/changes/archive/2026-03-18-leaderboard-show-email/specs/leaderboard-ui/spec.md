## MODIFIED Requirements

### Requirement: Professional rank display
Each leaderboard entry SHALL display a rank number (1-20). The top 3 ranks SHALL have visually distinct styling (gold for 1st, silver for 2nd, bronze for 3rd). All entries SHALL display in a consistent row layout with columns for rank, player name, email, score, stage reached, and date.

#### Scenario: Email displayed on each entry
- **WHEN** the leaderboard screen renders entries
- **THEN** each row displays the player's registered email below or alongside their name

#### Scenario: Entry without email
- **WHEN** a leaderboard entry has an empty email
- **THEN** the email area is blank or hidden (no placeholder text)
