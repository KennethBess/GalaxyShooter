## ADDED Requirements

### Requirement: Admin reset button on leaderboard screen
The leaderboard screen SHALL display a "Reset Scores" button only when the page URL contains the query parameter `admin=1`. The button SHALL be styled as a destructive action (red/warning color).

#### Scenario: Admin parameter present
- **WHEN** the user visits the leaderboard screen with `?admin=1` in the URL
- **THEN** a "Reset Scores" button is visible below the leaderboard entries

#### Scenario: Admin parameter absent
- **WHEN** the user visits the leaderboard screen without `admin=1` in the URL
- **THEN** no reset button is displayed

### Requirement: Confirmation before reset
Clicking the "Reset Scores" button SHALL trigger a native browser confirmation dialog. The reset SHALL only proceed if the user confirms.

#### Scenario: User confirms reset
- **WHEN** the user clicks "Reset Scores" and confirms the dialog
- **THEN** the client sends `DELETE /api/leaderboard?mode={currentMode}` where `currentMode` is the currently selected tab
- **AND** on success, the leaderboard view refreshes to show the empty state

#### Scenario: User cancels reset
- **WHEN** the user clicks "Reset Scores" and cancels the dialog
- **THEN** no API call is made and the leaderboard remains unchanged

### Requirement: Reset error feedback
If the reset API call fails, the client SHALL display the existing error state with a retry option.

#### Scenario: Reset API call fails
- **WHEN** the user confirms a reset and the DELETE request returns a non-200 status
- **THEN** the leaderboard screen displays an error message
