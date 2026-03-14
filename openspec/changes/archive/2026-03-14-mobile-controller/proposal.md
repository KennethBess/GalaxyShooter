## Why

Players currently need a keyboard to control their ship, which limits the game to desktop browsers. Many couch/party gaming setups use a shared screen (TV, laptop, projector) where individual players don't have keyboard access. Adding a mobile phone controller — similar to AirConsole — lets players point their phone at a QR code, open a touch-based control pad, and pilot their ship from the couch. The game renders only on the main screen; the phone shows just the controls.

## What Changes

- Add a **controller pairing system**: the main screen displays a QR code (or short URL) containing the room code and player ID. Scanning it on a phone opens a controller-only web page.
- Add a **controller web page** at `/controller` on the client: a mobile-optimized, touch-friendly page with a virtual d-pad, shoot button, and bomb button. No game rendering — just controls.
- Add a **controller WebSocket connection type**: the phone connects to the server as a "controller" for an existing player, sending `input` messages on their behalf. The server accepts input from the controller connection and writes it to the same `runtime.inputs` map as keyboard input.
- Add a **`controller_connect` client message** to the protocol: allows a secondary connection to attach as a controller for a specific player without replacing the main screen's connection or creating a new player slot.
- Add a **server-side controller connection tracking**: the server maps controller sockets to their target player ID, accepting `input` messages from controllers the same way it does from primary connections.
- Add a **QR code display** in the lobby screen and game sidebar showing the controller URL for the local player.

## Capabilities

### New Capabilities

- `mobile-controller-pairing`: QR code generation, controller URL scheme, and the pairing flow between main screen and phone.
- `mobile-controller-input`: The touch-based controller page, virtual d-pad/button layout, and the input transmission pipeline from phone to server.
- `controller-connection`: Server-side support for secondary "controller" connections that send input on behalf of an existing player, including the `controller_connect` message type and connection lifecycle.

### Modified Capabilities

_(none — the server's input consumption pipeline and physics are unchanged; controller input writes to the same `InputState` store)_

## Impact

- **Shared:** `packages/shared/src/index.ts` — add `controller_connect` to `ClientMessage` union, add `controller_paired` to `ServerMessage` union.
- **Server:** `apps/server/src/index.ts` — handle controller WebSocket connections. `apps/server/src/roomService.ts` — track controller connections, route their input to the target player's input map.
- **Client:** New `/controller` route/page (`apps/client/src/controller.ts`) — mobile-optimized touch UI. `apps/client/src/app.ts` — QR code display in lobby and game screens.
- **Dependencies:** Add a lightweight QR code generation library (e.g., `qrcode` or inline SVG generator) to the client.
- **Deployment:** No infrastructure changes — controller page served from the same Static Web App. WebSocket connections use the same gateway.
- **No server physics changes** — the `InputState` interface and `runtime.inputs.set(playerId, payload)` pipeline remain identical.
