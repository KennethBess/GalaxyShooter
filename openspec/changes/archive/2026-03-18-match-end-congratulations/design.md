## Context

The current results screen (`screen: "results"`) shows match stats with a staggered row animation and a score counter. It has buttons for "Back to lobby", "Front page", and "High Scores". The registration screen (`screen: "register"`) gates the home page — players must register before playing. There is no automatic session boundary; players stay registered until they manually click "Switch player".

## Goals / Non-Goals

**Goals:**
- Replace the results screen visual with a congratulations-focused layout
- Add a 10-second countdown timer with visual indicator
- Auto-redirect to registration screen when timer expires, clearing session data
- Keep existing navigation buttons (High Scores, Back to lobby) functional during countdown

**Non-Goals:**
- Changing the server-side match result payload
- Adding new server endpoints
- Modifying the registration screen itself
- Adding particle effects or complex WebGL animations (keep it CSS-based)

## Decisions

### 1. Reuse the existing `"results"` screen state
Rather than adding a new screen state, modify the `"results"` case in `getFrontMarkup` to render the congratulations layout. This avoids changing the state machine or the `match_result` message handler.

**Alternative considered:** Adding a `"congratulations"` screen state — rejected because it adds state machine complexity for what is purely a visual change.

### 2. CSS-only animations with a JS countdown timer
The entrance animations use CSS keyframes (fade-in, scale, slide-up). The countdown uses a `setInterval` that updates a DOM element every second. The timer is cleared if the user navigates away.

**Alternative considered:** CSS-only countdown with `animation-duration: 10s` — rejected because updating the visible countdown number requires JS.

### 3. Clear registration on auto-redirect only
When the 10-second timer fires, call `clearRegistration()` and `clearSession()` before transitioning to `"register"`. Manual navigation (High Scores, Back to lobby) does NOT clear registration — only the auto-redirect does.

## Risks / Trade-offs

- **Breaking the "Back to lobby" flow** → The congratulations screen still offers "Back to lobby" if the room is in `waiting` state. Timer is cancelled on any manual navigation.
- **10-second timer may feel too short or too long** → 10 seconds is enough to read the score and stats. Can be adjusted via a constant.
