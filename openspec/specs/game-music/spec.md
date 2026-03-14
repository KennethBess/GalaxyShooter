### Requirement: Lobby music plays on non-game screens
The client SHALL play a looping background music track ("lobby") on the home, lobby, results, scores, and settings screens. The track SHALL loop continuously and resume from the current position when navigating between these screens.

#### Scenario: Lobby music starts on app load
- **WHEN** the app loads and the user is on the home screen
- **THEN** the lobby music track begins playing (subject to browser autoplay policy — may require first user gesture)

#### Scenario: Lobby music continues across lobby screens
- **WHEN** the user navigates from home to lobby, or lobby to scores, or any non-game screen to another non-game screen
- **THEN** the lobby music continues playing without restarting

#### Scenario: Lobby music resumes after match
- **WHEN** the match ends and the screen transitions to results
- **THEN** the lobby music begins playing again

---

### Requirement: Battle music plays during active matches
The client SHALL play a looping background music track ("battle") on the game screen while a match is active.

#### Scenario: Battle music starts when match begins
- **WHEN** the screen transitions to the game screen
- **THEN** the battle music track begins playing

#### Scenario: Battle music stops when match ends
- **WHEN** the match ends and the screen transitions away from game
- **THEN** the battle music stops

---

### Requirement: Music crossfades on screen transitions
The client SHALL crossfade between lobby and battle music tracks when transitioning between non-game and game screens. The crossfade duration SHALL be approximately 500 milliseconds.

#### Scenario: Crossfade from lobby to battle
- **WHEN** the screen transitions from a non-game screen to the game screen
- **THEN** the lobby music fades out over ~500 ms while the battle music fades in over ~500 ms

#### Scenario: Crossfade from battle to lobby
- **WHEN** the screen transitions from the game screen to a non-game screen
- **THEN** the battle music fades out over ~500 ms while the lobby music fades in over ~500 ms

---

### Requirement: Music volume is user-configurable
The client SHALL provide a volume slider (range 0 to 1) and a mute toggle on the settings screen. Volume and mute state SHALL be persisted to localStorage and applied immediately when changed.

#### Scenario: Volume slider adjusts music level
- **WHEN** the user moves the volume slider to a new position
- **THEN** the currently playing music volume updates immediately to match the slider value

#### Scenario: Mute toggle silences music
- **WHEN** the user enables the mute toggle
- **THEN** all music playback is silenced (volume effectively 0) without stopping the track

#### Scenario: Unmute restores previous volume
- **WHEN** the user disables the mute toggle
- **THEN** music volume returns to the slider's current value

#### Scenario: Settings persist across sessions
- **WHEN** the user reloads the page after changing volume or mute settings
- **THEN** the saved volume and mute state are restored from localStorage

---

### Requirement: Audio assets loaded during boot
The client SHALL load both music audio files (`lobby.mp3` and `battle.mp3`) from `public/audio/` during the Phaser BootScene preload phase, before any screen is displayed.

#### Scenario: Audio files loaded at boot
- **WHEN** the BootScene preload runs
- **THEN** both `audio/lobby.mp3` and `audio/battle.mp3` are loaded into the Phaser audio cache
