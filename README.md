# Galaxy Shooter

Multiplayer browser shmup with code-based co-op rooms.

## Stack

- Client: Vite + TypeScript + Phaser 3
- Server: Node.js + Express + WebSockets / Azure Web PubSub upstream
- Shared contract: TypeScript types in `packages/shared`

## Run locally

1. Install dependencies:
   - `npm install`
2. Start the server:
   - `npm run dev:server`
3. Start the client:
   - `npm run dev:client`
4. Open `http://localhost:5173`

The server listens on `http://localhost:3001` by default.

## Implemented baseline

- Create room and join room via short game code
- Name-only join flow with no accounts
- Lobby with ready state, host start, and mode selection
- Authoritative multiplayer match loop for up to 4 players
- Shared campaign and survival modes
- Shared team lives, bombs, pickups, boss fights, and local high scores
- Reconnect grace window for dropped players
- Azure Web PubSub negotiation and upstream handling for scaled realtime ingress

## Azure deployment assets

- `azure.yaml`: azd application definition for `api` and `web`
- `infra/main.bicep`: subscription-scope entry point
- `infra/modules/app-stack.bicep`: Container Apps, ACR, Web PubSub, Redis, Static Web App, and monitoring resources
- `infra/main.parameters.json`: azd parameter mapping from environment values
- `apps/server/Dockerfile`: production container build for the backend
- `scripts/write-client-env.mjs`: writes `apps/client/.env.production.local` from the provisioned `API_URL`

### Expected azd environment values

- `AZURE_ENV_NAME`
- `AZURE_LOCATION`

### Backend runtime configuration provisioned by Bicep

- `REDIS_URL`
- `WEB_PUBSUB_CONNECTION_STRING`
- `WEB_PUBSUB_HUB`
- `ALLOWED_ORIGINS`
- `APPLICATIONINSIGHTS_CONNECTION_STRING`
- `ROOM_STATE_TTL_SECONDS`
- `ROOM_OWNER_TTL_SECONDS`

## Verification

- `npm test`
- `npm run build`

## Remaining before production deploy

- Validate the generated Bicep against your target subscription and region
- Confirm the Static Web App region/SKU combination in your target Azure geography
- Add PostgreSQL and online leaderboard persistence when you are ready to move beyond browser-local scores
