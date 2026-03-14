## 1. Shared Protocol

- [x] 1.1 Add `ControllerConnectMessage` interface and `ControllerPairedMessage` interface to `packages/shared/src/index.ts`
- [x] 1.2 Add `controller_connect` to `ClientMessage` union and `controller_paired` to `ServerMessage` union

## 2. Server — Controller Negotiation Endpoint

- [x] 2.1 Add `POST /realtime/negotiate/controller` endpoint in `apps/server/src/index.ts` that validates room+player and returns a WebSocket URL (direct or Web PubSub)
- [x] 2.2 Add Zod validation for the controller negotiate request body in `apps/server/src/validation.ts`

## 3. Server — Controller Connection Handling

- [x] 3.1 Add controller connection tracking to `RoomService` (map of controller socket/connectionId → target playerId)
- [x] 3.2 Handle `controller_connect` message in `processOwnerMessage`: validate room+player, register controller, send `controller_paired` response
- [x] 3.3 Route `input` and `use_bomb` messages from controller connections to the target player's input state and bomb queue
- [x] 3.4 Handle controller WebSocket disconnect: remove controller mapping without affecting the player
- [x] 3.5 Add direct WebSocket connection path for controllers in `index.ts` (new `/controller` WS path or query param to distinguish from player connections)
- [x] 3.6 Add Web PubSub connection path for controllers (handle `controller_connect` in the `handleUserEvent` handler)

## 4. Client — QR Code & Pairing UI

- [x] 4.1 Install `qrcode` npm package as a client dependency
- [x] 4.2 Add QR code display to the lobby screen in `apps/client/src/app.ts` showing the controller URL for the local player
- [x] 4.3 Add a QR code overlay/button accessible during gameplay on the game screen

## 5. Client — Controller Page

- [x] 5.1 Create `apps/client/controller.html` as a separate Vite entry point with mobile viewport meta tags
- [x] 5.2 Create `apps/client/src/controller.ts` — read `room` and `player` query params, call controller negotiate endpoint, establish WebSocket connection, send `controller_connect`, handle `controller_paired` response
- [x] 5.3 Build touch d-pad UI (left side) with touch event handlers that map to directional `InputState` booleans, including diagonal support
- [x] 5.4 Build shoot button (right side, large) and bomb button (right side, smaller) with touch event handlers
- [x] 5.5 Add connection status display (Connecting / Connected with player name / Disconnected)
- [x] 5.6 Add CSS styling: full-viewport, no-scroll, landscape-optimized layout with visual feedback on button presses
- [x] 5.7 Update Vite config (`apps/client/vite.config.ts`) to include `controller.html` as a second entry point in `build.rollupOptions.input`

## 6. Testing

- [x] 6.1 Add server tests for controller negotiation endpoint (valid room+player, invalid room, invalid player)
- [x] 6.2 Add server tests for controller connection lifecycle (pair, input routing, disconnect)
