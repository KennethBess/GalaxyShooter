## Why

When a match ends, the results screen shows stats but lacks a celebratory moment. Players should see an animated congratulations message that acknowledges their effort before being redirected back to the registration screen. This creates a natural session boundary — each play session ends with a congratulations flow that loops back to registration.

## What Changes

- Replace the current results screen with an animated congratulations page that shows the match outcome, score, and a celebratory message
- Add a 10-second auto-redirect timer that sends the player back to the registration screen
- Add a visual countdown indicator so the player knows when the redirect will happen
- Clear the player's session/registration on redirect so they re-register for the next session

## Capabilities

### New Capabilities

- `match-congratulations`: Animated post-match congratulations screen with timed auto-redirect to registration

### Modified Capabilities

_None — the existing results screen is being replaced, not extended._

## Impact

- **Client**: Modified results screen rendering in `app.ts`, new CSS animations in `style.css`, new auto-redirect timer logic
- **Server**: No changes
- **Shared**: No changes
