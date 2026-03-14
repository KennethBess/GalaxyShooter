## Context

Galaxy Shooter is a multiplayer browser game where players create/join rooms via REST, then connect over WebSocket (direct or Azure Web PubSub) to send input and receive 30 Hz snapshots. Input is a simple 5-boolean `InputState` (`up`, `down`, `left`, `right`, `shoot`). The server doesn't care where input comes from — it just reads `runtime.inputs.get(playerId)` on each tick.

Currently, only one WebSocket connection per player is supported. The connection is established after joining a room via `/realtime/negotiate`, and input flows from the keyboard through `RoomConnection.send()`. There is no concept of a secondary device sending input on behalf of an existing player.

The client is a single-page Phaser 3 app served from a Static Web App. All routes are handled client-side.

## Goals / Non-Goals

**Goals:**

- Let a mobile phone act as a virtual gamepad for an existing player, sending the same `InputState` the keyboard would
- Phone shows only touch controls (d-pad + buttons), no game rendering
- Pairing via QR code displayed on the main screen — scan to connect instantly
- Works with both direct WebSocket and Azure Web PubSub transports
- No changes to game physics, collision, or tick loop — controller input is indistinguishable from keyboard input

**Non-Goals:**

- Rendering the game on the mobile device
- Supporting multiple controllers per player
- Adding new input types beyond the existing `InputState` (analog stick, gyro, etc.)
- Controller authentication or security beyond knowing the room code + player ID
- Offline or Bluetooth controller support

## Decisions

### 1. Controller connects as a secondary WebSocket, not a new player

The phone opens a WebSocket to the same server, but sends a `controller_connect` message instead of going through the normal join flow. The server maps this connection to an existing player ID and accepts `input` messages from it, writing to the same `runtime.inputs` entry.

**Why not create a separate player?** The controller is a second input device for an existing player, not a new participant. Creating a new player would consume a slot, require a ship selection, and duplicate state. Reusing the existing player's input map keeps the server's tick loop unchanged.

**Why not relay through the main client?** Adding a peer-to-peer or relay layer between the phone and main client adds latency and complexity. The phone connecting directly to the server is simpler and lower-latency.

### 2. New REST endpoint for controller negotiation

Add `POST /realtime/negotiate/controller` that accepts `{ roomCode, playerId }` and returns a WebSocket URL. This is separate from the player negotiate endpoint to keep validation distinct — the controller endpoint verifies the player exists but does not require the caller to *be* that player (the phone has no session).

The controller URL (embedded in the QR code) includes the room code and player ID as query parameters. The phone's controller page reads these from the URL, calls the controller negotiate endpoint, and connects.

**Alternative considered:** Reusing `/realtime/negotiate` with a `role: "controller"` field. Rejected because the controller has a fundamentally different lifecycle (no join, no room state broadcasts needed) and mixing concerns would complicate validation.

### 3. Server tracks controller connections separately

`RoomService` gains a `controllerConnections` map (`Map<string, string>` — connectionId → playerId). When a controller WebSocket sends `controller_connect`, the server:
1. Validates the room code and player ID exist
2. Registers the connection as a controller for that player
3. Sends back a `controller_paired` confirmation message
4. Accepts `input` messages from this connection, writing to `runtime.inputs.set(targetPlayerId, payload)`

Controller connections are lightweight — they don't receive snapshots, room state, or game events. They only send input and receive the pairing confirmation.

**Disconnect handling:** When a controller disconnects, the server removes the mapping. The player remains in the game — only their controller input source is lost. The main screen's keyboard input (if any) continues to work.

### 4. Controller web page as a separate HTML entry point

Add `apps/client/controller.html` as a second Vite entry point, served at `/controller`. This page is a standalone mobile-optimized HTML page with touch controls — no Phaser, no game rendering, minimal JS bundle.

**Why a separate entry point?** The main game client loads Phaser, audio assets, and rendering code (~500KB+). The controller page needs only a WebSocket connection and touch event handlers (~10KB). Sharing an entry point would force mobile users to download the entire game bundle.

**Touch UI layout:**
- Left side: virtual d-pad (up/down/left/right) using touch areas
- Right side: shoot button (large, primary) and bomb button (smaller, secondary)
- Full-viewport, no scrolling, landscape-oriented
- CSS-only styling, no framework

### 5. QR code generation using inline SVG

Generate QR codes client-side using a lightweight library (`qrcode` npm package, ~30KB) that outputs SVG. The QR code encodes the full controller URL: `https://{host}/controller?room={code}&player={id}`.

Display the QR code:
- In the lobby screen, below the player list
- During gameplay, accessible via a small button/overlay

**Alternative considered:** Server-generated QR codes. Rejected because it adds an unnecessary round-trip and server load. The client already knows the host URL, room code, and player ID.

### 6. Input priority: last-write-wins

When both keyboard and controller are active for the same player, both write to the same `runtime.inputs.set(playerId, ...)`. The server reads this map once per tick, so the last write before the tick wins. This is acceptable because:
- In practice, users will use one input source at a time
- Both sources produce the same `InputState` shape
- No merging logic needed — keeps the server unchanged

### 7. Protocol additions

**New `ClientMessage` types:**
- `controller_connect`: `{ type: "controller_connect", payload: { roomCode: string, playerId: string } }` — sent by the phone immediately after WebSocket open to bind as a controller

**New `ServerMessage` types:**
- `controller_paired`: `{ type: "controller_paired", payload: { playerId: string, playerName: string } }` — sent to the controller confirming successful pairing

The existing `input` message type is reused by the controller — no new input message needed.

### 8. Use bomb via existing message type

The controller sends `use_bomb` the same way the keyboard does. No protocol changes needed for bombs.

## Risks / Trade-offs

**[Security] Anyone with the QR code / URL can control the player** → Acceptable for a party game. The room code + player ID combination is ephemeral and short-lived. Adding authentication would complicate the scan-and-play flow. Mitigation: room codes expire with TTL; the controller URL is only valid while the room exists.

**[UX] Touch controls may feel imprecise** → Mitigated by using large touch targets and providing visual feedback on press. The d-pad uses discrete directions (matching the boolean InputState) rather than analog, so precision isn't critical.

**[Latency] Mobile network adds RTT to input** → On the same WiFi network (typical party setup), latency is <10ms additional. On cellular, it could be 50-100ms. Acceptable for a casual party game. No mitigation planned.

**[Complexity] Two Vite entry points** → Minimal risk. Vite natively supports multi-page apps via `build.rollupOptions.input`. The controller page is self-contained with no shared state.

**[Web PubSub] Controller connections consume Azure connections** → Each controller is an additional WebSocket connection. For a 4-player game, this doubles connections from 4 to 8 max. Well within Azure Web PubSub limits. The controller connection is lightweight (input-only, no broadcasts).
