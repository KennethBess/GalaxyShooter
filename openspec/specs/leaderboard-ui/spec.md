## ADDED Requirements

### Requirement: Dedicated leaderboard screen
The client SHALL display a full-screen leaderboard view accessible from the landing page and the results screen. The screen SHALL show up to 20 entries with rank number, player name, score, stage reached, and time achieved.

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

### Requirement: Mode tab filtering
The leaderboard screen SHALL display tab-style toggles for "Campaign" and "Survival" modes. Switching tabs SHALL fetch and display the leaderboard for the selected mode.

#### Scenario: Switch from campaign to survival
- **WHEN** the user clicks the "Survival" tab while viewing the campaign leaderboard
- **THEN** the client fetches `GET /api/leaderboard?mode=survival`
- **AND** displays the survival leaderboard entries

#### Scenario: Default tab selection
- **WHEN** the user opens the leaderboard screen without a pre-selected mode
- **THEN** the "Campaign" tab is selected by default

### Requirement: Professional rank display
Each leaderboard entry SHALL display a rank number (1-20). The top 3 ranks SHALL have visually distinct styling (gold for 1st, silver for 2nd, bronze for 3rd). All entries SHALL display in a consistent row layout with columns for rank, player name, score, stage reached, and date.

#### Scenario: Top 3 entries have special styling
- **WHEN** the leaderboard screen renders entries
- **THEN** rank 1 displays with a gold accent color
- **AND** rank 2 displays with a silver accent color
- **AND** rank 3 displays with a bronze accent color

#### Scenario: Entries beyond top 3
- **WHEN** the leaderboard displays entries ranked 4-20
- **THEN** entries use the standard text color with no special rank styling

### Requirement: Animated entry transitions
Leaderboard entries SHALL animate in with a staggered reveal effect when the screen loads or when switching mode tabs.

#### Scenario: Initial load animation
- **WHEN** the leaderboard screen first renders with data
- **THEN** each row animates in sequentially with a staggered delay
- **AND** the animation respects the user's `prefers-reduced-motion` setting

#### Scenario: Tab switch animation
- **WHEN** the user switches mode tabs
- **THEN** the new entries animate in with the same staggered reveal effect

### Requirement: Post-match rank highlighting
When a player navigates to the leaderboard from the results screen after placing on the board, their new entry SHALL be visually highlighted.

#### Scenario: Player placed on leaderboard
- **WHEN** the user opens the leaderboard from the results screen
- **AND** the `match_result` included a non-null `leaderboardRank`
- **THEN** the entry at that rank is highlighted with a distinct glow or accent border

#### Scenario: Player did not place
- **WHEN** the user opens the leaderboard from the results screen
- **AND** the `match_result` included `leaderboardRank: null`
- **THEN** no entries are highlighted

### Requirement: Loading and empty states
The leaderboard screen SHALL display a loading indicator while fetching data and an empty-state message when no entries exist.

#### Scenario: Loading state
- **WHEN** the leaderboard screen is fetching data from the API
- **THEN** a loading indicator is displayed in place of the entry list

#### Scenario: Empty leaderboard
- **WHEN** the API returns an empty array for the selected mode
- **THEN** the screen displays a message such as "No scores yet — be the first!"

#### Scenario: API fetch failure
- **WHEN** the API request fails (network error or non-200 response)
- **THEN** the screen displays an error message with a "Retry" button

### Requirement: Responsive layout
The leaderboard screen SHALL be responsive across desktop and mobile viewports. On narrow screens, the layout SHALL adapt by hiding the date column and reducing horizontal padding.

#### Scenario: Desktop viewport
- **WHEN** the viewport width is 768px or greater
- **THEN** all columns are visible: rank, player name, score, stage, date

#### Scenario: Mobile viewport
- **WHEN** the viewport width is less than 768px
- **THEN** the date column is hidden
- **AND** padding and font sizes are reduced for a compact layout

### Requirement: Space-themed visual design
The leaderboard screen SHALL match the existing Galaxy Shooter visual language: dark gradient background, `--card` background for the entry container, `--accent` color for interactive elements, and the same font and spacing conventions used on the landing and results screens.

#### Scenario: Visual consistency
- **WHEN** the leaderboard screen is rendered
- **THEN** it uses the same CSS custom properties (`--bg-top`, `--card`, `--text`, `--accent`, etc.) as the rest of the application
- **AND** follows the `front-page > front-shell > front-card` layout structure
