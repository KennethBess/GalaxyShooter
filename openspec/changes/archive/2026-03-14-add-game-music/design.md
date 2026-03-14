## Context

Galaxy Shooter currently has no audio. The client uses Phaser 3 which includes a built-in Sound Manager supporting Web Audio API with autoplay-policy handling. All visual assets are procedurally generated at boot time — there are no external asset files yet. The app transitions between six screen states (`home`, `lobby`, `game`, `results`, `scores`, `settings`) managed by the `App` class in `app.ts`. Settings are persisted to localStorage via `storage.ts` and currently include `screenshake` and `reducedFlash`.

## Goals / Non-Goals

**Goals:**
- Play looping lobby music on home, lobby, scores, settings, and results screens.
- Play looping battle music during active matches (game screen).
- Crossfade smoothly between tracks on screen transitions.
- Provide a volume slider and mute toggle in the settings panel, persisted to localStorage.
- Load audio assets efficiently without blocking the initial page render.

**Non-Goals:**
- Sound effects (gunfire, explosions, pickups) — future change.
- Dynamic/adaptive music that reacts to gameplay events (boss fights, low health).
- Server-side audio coordination for multiplayer sync.
- Music selection or jukebox UI.

## Decisions

### D1: Use Phaser Sound Manager for playback

**Decision:** Use `scene.sound` (Phaser's built-in Web Audio-backed sound manager) for all music playback and volume control.

**Rationale:** Phaser already handles Web Audio context creation, autoplay policy (user gesture unlock), and focus/blur pausing. Avoids adding a separate audio library. The `GameScene` is always active during gameplay and persists across screen transitions since the Phaser game instance is long-lived.

**Alternative considered:** Raw Web Audio API or Howler.js. Rejected: unnecessary dependency; Phaser's sound manager is sufficient for background music.

---

### D2: Load audio in BootScene, reference globally

**Decision:** Load both music tracks in `BootScene.preload()` using `this.load.audio()`. Store references as keyed Phaser sounds accessible from `GameScene` and from the `App` class via the game controller interface.

**Rationale:** BootScene already handles asset initialization. Loading audio here ensures tracks are ready before any screen is shown. The game controller interface (`GameController`) is already the bridge between the DOM-based App and the Phaser scenes — extending it with music controls is natural.

---

### D3: Music files as static assets in `public/audio/`

**Decision:** Place two audio files in `apps/client/public/audio/`: `lobby.mp3` and `battle.mp3`. Use MP3 format for broad browser compatibility.

**Rationale:** Vite serves `public/` contents as static assets at the root URL. MP3 is universally supported. OGG fallback is unnecessary for modern browsers. Files should be kept under 2 MB each for fast loading.

**Note:** The actual music files must be sourced as royalty-free/CC0 tracks and added manually. The implementation will reference them by path; placeholder files can be used during development.

---

### D4: Crossfade on screen transitions

**Decision:** When transitioning between lobby screens and game screen, fade out the current track over 500 ms while fading in the new track over 500 ms using Phaser tween-based volume transitions.

**Rationale:** Abrupt cuts feel jarring. A short crossfade is simple to implement with Phaser tweens and provides a polished feel. 500 ms is fast enough to not delay the transition.

---

### D5: Volume and mute persisted in StoredSettings

**Decision:** Add `musicVolume: number` (0–1, default 0.5) and `musicMuted: boolean` (default false) to the `StoredSettings` interface. The settings screen gets a range slider and a mute checkbox. Changes apply immediately and persist to localStorage.

**Rationale:** Consistent with existing settings pattern. Volume as a 0–1 float maps directly to Phaser's `sound.volume` property.

---

### D6: Extend GameController interface for music control

**Decision:** Add `playMusic(track: "lobby" | "battle"): void` and `setMusicVolume(volume: number, muted: boolean): void` methods to the `GameController` interface. The `App` class calls `playMusic` on screen transitions and `setMusicVolume` when settings change.

**Rationale:** Keeps the Phaser audio logic inside the Phaser layer while letting the DOM-based App class control which track plays. This follows the existing pattern where `App` drives the game through the controller interface.

## Risks / Trade-offs

- **Autoplay policy** → Phaser's sound manager handles this by unlocking the audio context on the first user gesture. The lobby track may not play until the user clicks something, which is acceptable since creating/joining a room requires a click.
- **File size** → Two MP3 tracks add download weight. Mitigated by keeping each under 2 MB and loading during BootScene (before any gameplay).
- **Music sourcing** → Actual music files must be sourced externally (royalty-free). Implementation tasks will reference paths; files must be added separately.
- **CSP update** → The current CSP lacks `media-src`. Adding `media-src 'self'` is required. Low risk since audio is same-origin only.
