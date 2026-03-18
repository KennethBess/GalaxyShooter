## Why

Players on the registration screen have no way to view the leaderboard. Adding a link lets new or returning players see current high scores before registering, creating motivation to play.

## What Changes

- Add a "Leaderboard" button to the registration screen, below the registration form
- Clicking it navigates to the existing leaderboard screen and sets `previousScreen` so the back button returns to registration

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `leaderboard-ui`: Adding navigation from registration screen to leaderboard

## Impact

- **Client**: Small markup change in `app.ts` (register case) and a click handler addition
- **Server**: No changes
