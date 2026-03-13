# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Galaxy Shooter is a multiplayer browser-based space shooter built as a TypeScript monorepo. The server is authoritative — all game physics and state live server-side, with clients receiving 30 Hz snapshots and performing local interpolation.

## Monorepo Structure

Three npm workspaces:
- `apps/client` (`@space-shmup/client`) — Phaser 3 + Vite browser game
- `apps/server` (`@space-shmup/server`) — Express + WebSocket game server
- `packages/shared` (`@space-shmup/shared`) — Shared types and constants (no runtime deps)

## Commands

All commands run from the repo root unless noted.

```bash
# Development
npm run dev:client        # Vite dev server on port 5173
npm run dev:server        # tsx watch on port 3001

# Build
npm run build             # Builds server (tsup) and client (vite)

# Test (Node.js built-in test runner)
npm test                  # Runs server + shared tests

# Lint (Biome — linter only, formatter is disabled)
npm run lint
```

**Running a single test file:**
```bash
node --import tsx --test apps/server/test/combat.test.ts
```

## Architecture

### Real-time Communication

- **Production:** Azure Web PubSub (subprotocol `json.webpubsub.azure.v1`) — clients negotiate a connection URL via REST before connecting
- **Local dev:** Direct WebSocket fallback
- `connectionGateway.ts` abstracts both transports behind a common interface

### Game Loop

The server runs a tick loop at `TICK_RATE = 30` Hz. Each tick runs physics, collision detection, enemy AI, and broadcasts a `snapshot` message to all room players. Clients lerp positions using constants from `packages/shared`.

### Room Lifecycle

`waiting → starting → in_match → results → closed`

Rooms are persisted to Redis with TTL-based ownership leases. `roomRepository.ts` handles persistence; `roomMessageBus.ts` handles cross-instance pub/sub for multi-replica deployments. `roomService.ts` caches room state in memory to avoid Redis contention on every tick.

### Message Protocol

All WebSocket messages are discriminated unions defined in `packages/shared/src/index.ts`:
- `ClientMessage` — `input | ready | set_mode | start_match | use_bomb | leave_room | reconnect | ping`
- `ServerMessage` — `room_state | player_joined | player_left | match_started | snapshot | game_event | match_result | error`

### Key Server Files

| File | Purpose |
|------|---------|
| `apps/server/src/index.ts` | Express app, Web PubSub handler, route definitions |
| `apps/server/src/roomService.ts` | Room creation/joining, player lifecycle, in-memory state cache |
| `apps/server/src/game.ts` | Tick loop and match execution |
| `apps/server/src/combat.ts` | Collision detection, enemy AI, scoring |
| `apps/server/src/roomRepository.ts` | Redis persistence layer |
| `apps/server/src/roomMessageBus.ts` | Cross-instance pub/sub |
| `apps/server/src/connectionGateway.ts` | WebSocket/Web PubSub abstraction |

### Key Client Files

| File | Purpose |
|------|---------|
| `apps/client/src/app.ts` | Phaser scene logic, input, rendering |
| `apps/client/src/network.ts` | WebSocket connection and message dispatch |
| `apps/client/src/api.ts` | REST calls (create/join room, negotiate realtime) |
| `apps/client/src/phaser/game.ts` | Phaser-specific rendering and animation |

## Code Conventions

- **Pure ESM** — no CommonJS, no `require()`, no `module.exports`
- **Naming:** PascalCase for classes/interfaces, camelCase elsewhere, no `I` prefix on interfaces, kebab-case filenames
- **Type safety:** Avoid `any`; use discriminated unions for message/state types; all external input validated with Zod
- **Async:** `async/await` with `try/catch`; guard edge cases early with early returns

## Testing Conventions

Tests use Node.js built-in `node:test` and `node:assert/strict`. Avoid brittle timing assertions. Test files live in `apps/server/test/` and `packages/shared/test/`.

## Environment Variables (server)

Provisioned by Azure Bicep in production; set locally in `.env`:
- `REDIS_URL`
- `WEB_PUBSUB_CONNECTION_STRING`
- `WEB_PUBSUB_HUB`
- `ALLOWED_ORIGINS`
- `APPLICATIONINSIGHTS_CONNECTION_STRING`
- `ROOM_STATE_TTL_SECONDS`
- `ROOM_OWNER_TTL_SECONDS`

## Deployment

- `azure.yaml` defines two services: `api` (Docker container, `apps/server/Dockerfile`) and `web` (static, `apps/client/dist`)
- Deploy via `azd deploy --no-prompt`
- `scripts/write-client-env.mjs` runs as a pre-package hook to inject the API URL into the client build
- Infrastructure defined in `infra/` as Azure Bicep (Container Apps, ACR, Web PubSub, Redis, Static Web App)
