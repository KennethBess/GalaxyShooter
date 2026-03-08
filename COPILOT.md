# Galaxy Shooter — Copilot Context

## Architecture

TypeScript monorepo (npm workspaces) for a multiplayer browser space shooter.

```
apps/
  client/     Phaser 3 game client (Vite, ESM)
  server/     Authoritative game server (Express, WebSocket, Redis)
packages/
  shared/     Types, constants, and interfaces shared between client & server
infra/        Azure Bicep IaC (Container Apps, Static Web Apps, Web PubSub, Redis Enterprise)
```

## Key Design Decisions

### Authoritative Server
The server is the source of truth for all game state. The client receives snapshots at 30 Hz and interpolates positions locally. Physics and collision detection run server-side only — the client uses manual position math (no Phaser physics engine).

### Shared Package
`@space-shmup/shared` defines all types, constants, and message interfaces used by both client and server. Any value that must stay in sync (movement bounds, tick rate, ship options) lives here.

### Real-time Communication
Uses Azure Web PubSub for WebSocket transport in production, with a direct WebSocket fallback for local development.

## Conventions

- **Module system**: ESM throughout (`"type": "module"`)
- **TypeScript**: ES2022 target, strict mode, Bundler module resolution
- **Imports**: Use `@shared/index` alias (client via Vite, server via tsconfig paths)
- **Linting**: Biome 2.x (`biome check .`)
- **Testing**: Node built-in test runner with `tsx` (`node --import tsx --test`)
- **Build**: Client → Vite; Server → tsup
- **Infrastructure**: Azure Bicep modules in `infra/`

## Commands

| Task | Command |
|------|---------|
| Build all | `npm run build` |
| Test all | `npm test` |
| Lint | `npm run lint` |
| Dev client | `npm run dev:client` |
| Dev server | `npm run dev:server` |
| Deploy | `azd up` |

## Data Flow

1. Client sends `InputState` (keyboard state) to server via WebSocket
2. Server runs game loop at `TICK_RATE` (30 Hz), updates all entity positions
3. Server broadcasts `SnapshotState` to all clients
4. Client interpolates between snapshots using drift thresholds and lerp factors
5. Match results are sent as `MatchResultMessage` when game ends
