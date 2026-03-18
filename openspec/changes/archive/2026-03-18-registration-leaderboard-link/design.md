## Context

The registration screen currently has a form (full name, email, phone) and a submit button. The leaderboard screen supports navigating back to the previous screen via `state.previousScreen`. The back button handler already checks this value to determine where to return.

## Goals / Non-Goals

**Goals:**
- Add a "Leaderboard" button to the registration screen
- Set `previousScreen` to `"register"` so the back button returns to registration
- Update the back-from-scores handler to support returning to `"register"`

**Non-Goals:**
- Changing the leaderboard screen layout
- Adding authentication to leaderboard access

## Decisions

### 1. Reuse existing previousScreen pattern
Set `previousScreen` to a value that the back handler recognizes. The current handler checks for `"results"` — extend it to also handle `"register"`.

### 2. Place button below the form in a utility-actions div
Consistent with the home screen layout which has Leaderboard/Settings below the main form.
