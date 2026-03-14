## Why

The game currently has no audio at all — no music, no sound effects. Music is a core part of the arcade shooter experience, setting tone in the lobby and driving adrenaline during gameplay. Adding background music for the lobby and in-match screens will significantly improve player immersion.

## What Changes

- Add a Phaser-based audio manager that handles music loading, playback, crossfading, and muting.
- Add a looping **lobby music track** (retro/chiptune shooting game theme) that plays on the home/lobby/results screens.
- Add a looping **battle music track** (high-energy, motivating) that plays during active matches.
- Crossfade between tracks when transitioning from lobby to game and back.
- Add a **music volume slider** and **mute toggle** to the settings screen, persisted to localStorage.
- Add music asset files to `apps/client/public/audio/` so Vite serves them as static assets.
- Update CSP `media-src` directive in `index.html` to allow same-origin audio playback.

## Capabilities

### New Capabilities

- `game-music`: Background music playback for lobby and in-match screens, with volume/mute controls and crossfade transitions.

### Modified Capabilities

_(none — no existing spec-level requirements are changing)_

## Impact

- **Client:** `apps/client/src/app.ts` (screen transition hooks for music), `apps/client/src/phaser/game.ts` (Phaser audio loading and playback), new settings UI controls.
- **Assets:** New audio files in `apps/client/public/audio/` (lobby track, battle track). Files should be royalty-free or CC0-licensed.
- **Deployment:** Audio files served via Azure Static Web Apps alongside existing assets. CSP header update needed for `media-src 'self'`.
- **Server:** No changes.
- **Shared:** No changes.
