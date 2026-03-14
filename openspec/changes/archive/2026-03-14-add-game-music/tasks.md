## 1. Audio Assets & CSP

- [x] 1.1 Create `apps/client/public/audio/` directory and add placeholder `lobby.mp3` and `battle.mp3` files (royalty-free chiptune lobby theme and high-energy battle track)
- [x] 1.2 Update the CSP `<meta>` tag in `apps/client/index.html` to add `media-src 'self'`

## 2. Settings Persistence

- [x] 2.1 Add `musicVolume: number` (default `0.5`) and `musicMuted: boolean` (default `false`) to the `StoredSettings` interface and `loadSettings` default in `apps/client/src/storage.ts`

## 3. Phaser Audio Loading

- [x] 3.1 In `BootScene.preload()` (`apps/client/src/phaser/game.ts`), add `this.load.audio("lobby", "audio/lobby.mp3")` and `this.load.audio("battle", "audio/battle.mp3")`

## 4. GameController Music API

- [x] 4.1 Add `playMusic(track: "lobby" | "battle"): void` and `setMusicVolume(volume: number, muted: boolean): void` methods to the `GameController` interface in `apps/client/src/phaser/game.ts`
- [x] 4.2 Implement `playMusic` in `GameScene`: create or resume the requested Phaser sound, crossfade from the current track (fade out over 500 ms, fade in over 500 ms), loop both tracks
- [x] 4.3 Implement `setMusicVolume`: set `this.sound.volume` based on volume and muted state, apply immediately to the active track

## 5. App Screen Transition Hooks

- [x] 5.1 In `App.render()` (`apps/client/src/app.ts`), after setting the screen, call `this.game.playMusic(this.state.screen === "game" ? "battle" : "lobby")` to trigger the correct track on every screen transition
- [x] 5.2 On initial app construction, call `playMusic("lobby")` to start lobby music (will activate after first user gesture per autoplay policy)

## 6. Settings UI

- [x] 6.1 Add a music volume range slider (`<input type="range" min="0" max="1" step="0.05">`) and a mute checkbox to the settings screen markup in `app.ts`
- [x] 6.2 Bind change events on the slider and checkbox to call `saveSettings` and `this.game.setMusicVolume(volume, muted)` immediately
- [x] 6.3 Initialize the slider and checkbox values from `this.settings` on settings screen render

## 7. Verification

- [x] 7.1 Run `npm run build` and confirm client builds without errors
- [x] 7.2 Run `npm run dev:client` and manually verify: lobby music plays on home screen, crossfades to battle music on match start, volume slider and mute toggle work, settings persist across refresh
