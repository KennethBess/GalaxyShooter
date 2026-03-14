## Why

Galaxy Shooter currently has no mid-match progression — players fly and shoot but have no collectible rewards or situational advantages to pursue. Adding power-ups gives players moment-to-moment decisions and a sense of reward, increasing engagement and match variety.

## What Changes

- Enemies and destroyed asteroids (or dedicated spawners) drop collectible pickup entities on the server.
- Four power-up types are introduced: **Shield**, **Rapid Fire**, **Triple Shot**, and **Bomb Refill**.
- The server authorizes pickup collection (proximity check), applies the effect to the player's state, and broadcasts the event to all clients.
- Clients render pickup sprites, animate collection, and display an active-effect HUD indicator.
- Power-up effects are time-limited; the server tracks expiry and reverts state when they expire.
- Pickup entities are included in the 30 Hz `snapshot` broadcast so all players see them in real time.

## Capabilities

### New Capabilities

- `power-ups`: Spawning, collection, and expiry lifecycle of in-match collectible power-up entities including server-side effect application and client-side rendering.

### Modified Capabilities

- `snapshot`: Snapshot message must carry the pickup entity list alongside existing player/enemy data.

## Impact

- **Server:** `game.ts` (tick loop spawning & expiry), `combat.ts` (pickup collision), `packages/shared` (new message fields and power-up type enum).
- **Client:** `app.ts` / `phaser/game.ts` (pickup sprite rendering, HUD effect indicators), `network.ts` (handle new snapshot fields and `game_event` pickup types).
- **Shared:** `ClientMessage`/`ServerMessage` discriminated unions extended; new `PowerUpType` enum and `PickupEntity` type added.
- No breaking changes to existing room lifecycle or player authentication.
