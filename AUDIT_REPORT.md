# Galaxy Shooter — TypeScript Monorepo Audit Report

Audit performed against:
- `.github/instructions/typescript-5-es2022.instructions.md` (applies to `**/*.ts`)
- `.github/instructions/nodejs-javascript-vitest.instructions.md` (applies to `**/*.js, **/*.mjs, **/*.cjs` — findings noted where relevant to `.ts` source)

---

## Critical Findings

### 1. Unsafe type assertions on external/untrusted input — no schema validation

| Detail | Value |
|---|---|
| **File** | `apps/server/src/index.ts` |
| **Lines** | 95, 180, 203, 219, 273 |
| **Rule violated** | Type System ("Avoid `any`; prefer `unknown` plus narrowing") + Security ("Validate and sanitize external input with schema validators or type guards") |
| **Severity** | Critical |
| **Finding** | HTTP request bodies and WebSocket messages are cast directly to typed interfaces with `as` without any runtime validation. For example: `req.body as CreateRoomRequest`, `req.data as ClientMessage`, `JSON.parse(raw.toString()) as ClientMessage`. A malformed or malicious payload passes type checks at compile time but has no runtime guard. |
| **Recommendation** | Introduce a schema validation library (e.g. Zod, Valibot) or hand-written type guards for `CreateRoomRequest`, `JoinRoomRequest`, `RealtimeNegotiationRequest`, and `ClientMessage`. Parse and validate before processing. Example: `const body = CreateRoomRequestSchema.parse(req.body);` |

### 2. Unsafe type assertions on Redis pub/sub messages

| Detail | Value |
|---|---|
| **File** | `apps/server/src/roomMessageBus.ts` |
| **Lines** | 71, 74 |
| **Rule violated** | Type System + Security ("Validate and sanitize external input with schema validators or type guards") |
| **Severity** | Critical |
| **Finding** | Messages received from Redis subscriptions are `JSON.parse(raw) as RoomCommandEnvelope` / `RoomEventEnvelope` with no validation. In a multi-instance deployment, a corrupt or tampered Redis message would be silently accepted. |
| **Recommendation** | Add type guards or schema validation before processing deserialized pub/sub payloads. |

### 3. `InputState` interface duplicated across three files

| Detail | Value |
|---|---|
| **File** | `apps/client/src/phaser/game.ts` (L5–11), `apps/server/src/runtime.ts` (L4–10), `apps/server/src/gameTypes.ts` (L12–18) |
| **Lines** | See above |
| **Rule violated** | Type System ("Centralize shared contracts instead of duplicating shapes") |
| **Severity** | Critical |
| **Finding** | The `InputState` interface is independently defined in three separate files with identical shape. If any copy drifts, subtle protocol bugs will emerge between client and server. |
| **Recommendation** | Move `InputState` to `packages/shared/src/index.ts` and import it from there in all three locations. |

---

## Major Findings

### 4. Non-kebab-case filenames throughout the server

| Detail | Value |
|---|---|
| **File** | `apps/server/src/` — 11 files |
| **Lines** | N/A (filenames) |
| **Rule violated** | Project Organization ("Use kebab-case filenames, e.g. `user-session.ts`") |
| **Severity** | Major |
| **Finding** | All multi-word filenames in the server use camelCase: `connectionGateway.ts`, `gameTypes.ts`, `matchService.ts`, `roomDirectory.ts`, `roomManager.ts`, `roomManagerFactory.ts`, `roomMessageBus.ts`, `roomRepository.ts`, `roomService.ts`, `runtimeRegistry.ts`, `webPubSubConnectionGateway.ts`. |
| **Recommendation** | Rename to kebab-case: `connection-gateway.ts`, `game-types.ts`, `match-service.ts`, `room-directory.ts`, `room-manager.ts`, `room-manager-factory.ts`, `room-message-bus.ts`, `room-repository.ts`, `room-service.ts`, `runtime-registry.ts`, `web-pub-sub-connection-gateway.ts`. Update all import paths accordingly. |

### 5. No test files exist anywhere in the repository

| Detail | Value |
|---|---|
| **File** | Entire repository |
| **Lines** | N/A |
| **Rule violated** | Testing ("Add or update unit tests with the project's framework") + Vitest instructions ("Write tests for all new features and bug fixes") |
| **Severity** | Major |
| **Finding** | No test files (`.test.ts`, `.spec.ts`) were found anywhere in the monorepo. Critical game logic (collision detection, scoring, stage transitions), room lifecycle, and network handling are entirely untested. |
| **Recommendation** | Add Vitest tests starting with the highest-risk, pure-function modules: `combat.ts`, `game.ts`, `gameTypes.ts` (utility functions), `runtime.ts`, `matchService.ts`. Then add integration tests for `roomService.ts`. |

### 6. Missing JSDoc on all public APIs

| Detail | Value |
|---|---|
| **File** | All source files |
| **Lines** | All exported functions, classes, and interfaces |
| **Rule violated** | Documentation ("Add JSDoc to public APIs; include `@remarks` or `@example` when helpful") |
| **Severity** | Major |
| **Finding** | None of the exported functions, classes, or interfaces across the entire codebase have JSDoc documentation. Key APIs like `createMatch`, `updateMatch`, `resolveCollisions`, `RoomService`, `ConnectionGateway`, and all shared types lack any documentation. |
| **Recommendation** | Add JSDoc at minimum to: all interfaces in `packages/shared/src/index.ts`, all exported functions in server game logic (`game.ts`, `combat.ts`), and all interface/class exports used for DI (`ConnectionGateway`, `RoomRepository`, `RoomDirectory`, `RoomMessageBus`). |

### 7. No retry/backoff on network or IO calls

| Detail | Value |
|---|---|
| **File** | `apps/client/src/api.ts`, `apps/client/src/network.ts` |
| **Lines** | api.ts:18–30, network.ts:59–99 |
| **Rule violated** | External Integrations ("Apply retries, backoff, and cancellation to network or IO calls") |
| **Severity** | Major |
| **Finding** | The `request()` helper in `api.ts` performs a single `fetch()` with no retry logic. The WebSocket connection in `network.ts` `openSocket()` fails on first error with no reconnection attempt. In a multiplayer game, transient network failures are expected. |
| **Recommendation** | Add exponential backoff retry (e.g. 3 attempts with 1s/2s/4s delays) to the `request()` function. Add auto-reconnect logic to `RoomConnection` with backoff. |

### 8. Silent error swallowing in async flows

| Detail | Value |
|---|---|
| **File** | `apps/client/src/network.ts` |
| **Lines** | 147 |
| **Rule violated** | Async & Error Handling ("Send errors through the project's logging/telemetry utilities") |
| **Severity** | Major |
| **Finding** | `rawData.text().then(…).catch(() => {})` silently swallows Blob parsing errors. Failed message deserialization is invisible to developers. |
| **Recommendation** | Log the error via `console.error` or a client-side telemetry channel: `.catch((err) => console.error("Failed to parse incoming message", err))`. |

### 9. `console.error` / `console.warn` used directly bypassing project logger

| Detail | Value |
|---|---|
| **File** | `apps/server/src/roomManagerFactory.ts` (L70), `apps/server/src/roomMessageBus.ts` (L97–98) |
| **Lines** | See above |
| **Rule violated** | Async & Error Handling ("Send errors through the project's logging/telemetry utilities") |
| **Severity** | Major |
| **Finding** | Redis client errors in `roomManagerFactory.ts` use `console.error` directly, and handler overwrite warnings in `roomMessageBus.ts` use `console.warn`. The project has a structured logger (`logError`, `logWarn`) with Application Insights integration that is bypassed. |
| **Recommendation** | Replace `console.error("Redis client error", error)` with `logError("Redis client error", error)` and `console.warn(…)` with `logWarn(…)`. Import the logger in both files. |

### 10. `App` class is too large (~720 lines) with mixed concerns

| Detail | Value |
|---|---|
| **File** | `apps/client/src/app.ts` |
| **Lines** | 1–740 |
| **Rule violated** | Core Intent ("short methods and classes, clean code") + Architecture ("Keep transport, domain, and presentation layers decoupled") |
| **Severity** | Major |
| **Finding** | The `App` class handles UI rendering, DOM event binding, network connection management, state transitions, form handling, game lifecycle, and settings persistence — all in a single ~720-line class. This violates single-responsibility and makes the code difficult to test and maintain. |
| **Recommendation** | Extract concerns into focused modules: a `UIRenderer` for DOM rendering/binding, a `RoomConnectionManager` for connection lifecycle, a `GameStateManager` for state transitions, and keep `App` as a thin coordinator. |

### 11. No structured error types — all errors are plain `Error` with strings

| Detail | Value |
|---|---|
| **File** | All server source files |
| **Lines** | Throughout (e.g., `roomService.ts` L73–76, `index.ts` L186–189, L210–214) |
| **Rule violated** | Async & Error Handling ("wrap awaits in try/catch with structured errors") |
| **Severity** | Major |
| **Finding** | All errors are thrown as `new Error("string message")`. Error handling in HTTP routes relies on string comparison (`message === "Room not found"` on index.ts L211, L242) to determine HTTP status codes. This is fragile and untyped. |
| **Recommendation** | Create domain error classes (e.g. `RoomNotFoundError`, `RoomFullError`, `ValidationError`) with error codes. Use `instanceof` checks in route handlers instead of string matching. |

---

## Minor Findings

### 12. Unchecked type assertions in client DOM/event code

| Detail | Value |
|---|---|
| **File** | `apps/client/src/app.ts` |
| **Lines** | 435, 441, 471, 475, 478 |
| **Rule violated** | Type System ("Avoid `any`; prefer `unknown` plus narrowing") |
| **Severity** | Minor |
| **Finding** | Multiple unchecked `as` casts: `input.value as ShipId` (L435), `input.value` as room code without validation (L441), `(event.target as HTMLSelectElement).value as GameMode` (L471). While DOM event targets are generally predictable, these bypass type safety. |
| **Recommendation** | Use the existing `resolveShipId()` helper (or the shared `isShipId()` guard) at the point of assignment. For `GameMode`, add a type guard. |

### 13. Unused import: `GAME_WIDTH` in `gameTypes.ts`

| Detail | Value |
|---|---|
| **File** | `apps/server/src/gameTypes.ts` |
| **Lines** | 1 |
| **Rule violated** | Formatting & Style (clean code, focused) |
| **Severity** | Minor |
| **Finding** | `GAME_WIDTH` is imported from shared but never used in this file. The `LANES` constant uses hardcoded values instead. |
| **Recommendation** | Remove the unused `GAME_WIDTH` import. If the hardcoded `LANES` values are derived from `GAME_WIDTH`, express that relationship explicitly (e.g. compute from `GAME_WIDTH`). |

### 14. Mutable arrays should use `readonly` for configuration constants

| Detail | Value |
|---|---|
| **File** | `packages/shared/src/index.ts` (L25), `apps/server/src/stages.ts` (L3, L24) |
| **Lines** | See above |
| **Rule violated** | Type System ("Express intent with TypeScript utility types, e.g. `Readonly`") + Formatting ("Favor immutable data") |
| **Severity** | Minor |
| **Finding** | `SHIP_OPTIONS` is typed as `ShipOption[]`, `BOSS_PHASES` as `BossPhaseDef[]`, and `CAMPAIGN_STAGES` as `StageDef[]`. These are configuration constants that should never be mutated at runtime but their types permit mutation. |
| **Recommendation** | Type these as `readonly ShipOption[]`, `readonly BossPhaseDef[]`, and `readonly StageDef[]` respectively. Consider adding `as const satisfies …` for deeper immutability. |

### 15. `process.env` accessed directly outside config helper

| Detail | Value |
|---|---|
| **File** | `apps/server/src/index.ts` (L25, L322), `apps/server/src/telemetry.ts` (L3–4) |
| **Lines** | See above |
| **Rule violated** | Configuration ("Reach configuration through shared helpers and validate with schemas") |
| **Severity** | Minor |
| **Finding** | `ALLOWED_ORIGINS` and `PORT` are read from `process.env` directly in `index.ts`, and `APPLICATIONINSIGHTS_CONNECTION_STRING` / `NODE_ENV` are read in `telemetry.ts`. The project has a `loadBackendConfig()` helper in `config.ts` that should centralize all env access. |
| **Recommendation** | Add `port`, `allowedOrigins`, and `appInsightsConnectionString` to `BackendConfig` and read them through `loadBackendConfig()`. |

### 16. `App` class constructor triggers async work without awaiting

| Detail | Value |
|---|---|
| **File** | `apps/client/src/app.ts` |
| **Lines** | 46 |
| **Rule violated** | Async & Error Handling ("Use async/await; wrap awaits in try/catch") |
| **Severity** | Minor |
| **Finding** | `void this.tryReconnect()` fires an async reconnection attempt in the constructor. Errors are caught internally, but the fire-and-forget pattern in a constructor makes lifecycle ordering harder to reason about. |
| **Recommendation** | Consider a static factory method: `static async create(root: HTMLElement): Promise<App>` that awaits reconnection before returning. |

### 17. Missing `dispose()` lifecycle method on `App` and game controller

| Detail | Value |
|---|---|
| **File** | `apps/client/src/app.ts`, `apps/client/src/phaser/game.ts` |
| **Lines** | app.ts (entire class), game.ts:576–603 |
| **Rule violated** | Architecture ("Supply lifecycle hooks, e.g. `initialize`, `dispose`") + Performance ("Track resource lifetimes to prevent leaks") |
| **Severity** | Minor |
| **Finding** | `App` has no `dispose()` method to clean up the WebSocket connection, abort controller, Phaser game, and event listeners. The `GameController` interface exposes `destroy()` but `App` never calls it. If `App` is ever unmounted/recreated, resources leak. |
| **Recommendation** | Add a `dispose()` method to `App` that calls `this.connection?.disconnect()`, `this.eventAbort?.abort()`, and `this.game.destroy()`. |

### 18. Server-side HTML entity encoding in player names (cross-concern)

| Detail | Value |
|---|---|
| **File** | `apps/server/src/roomService.ts` |
| **Lines** | 487–498 |
| **Rule violated** | Security / Architecture ("Keep transport, domain, and presentation layers decoupled") |
| **Severity** | Minor |
| **Finding** | `validateName()` encodes HTML entities (`&amp;`, `&lt;`, etc.) on the server side. This means stored player names contain HTML entities (e.g., `O&#39;Brien`). The client also calls `escape()` before rendering, leading to potential double-encoding. HTML encoding is a presentation concern and should be handled at render time only. |
| **Recommendation** | Remove HTML encoding from `validateName()`. Keep only length/content validation server-side. The client's `escape()` method already handles rendering safely. |

### 19. `RoomManager` class is a thin pass-through wrapper

| Detail | Value |
|---|---|
| **File** | `apps/server/src/roomManager.ts` |
| **Lines** | 1–42 |
| **Rule violated** | Core Intent ("Prefer readable, explicit solutions") + Architecture ("Keep modules single-purpose") |
| **Severity** | Minor |
| **Finding** | `RoomManager` delegates every method directly to `RoomService` with no added behavior, validation, or transformation. It adds an unnecessary layer of indirection. |
| **Recommendation** | Either remove `RoomManager` and use `RoomService` directly, or give it a clear responsibility (e.g., facade adding cross-cutting concerns like logging/metrics around service calls). |

### 20. String-template SVG with interpolated values (low XSS risk)

| Detail | Value |
|---|---|
| **File** | `apps/client/src/templates.ts` |
| **Lines** | 12–28 |
| **Rule violated** | Security ("Encode untrusted content before rendering HTML") |
| **Severity** | Minor |
| **Finding** | `shipPreviewSvg()` interpolates `ship.primary`, `ship.dark`, etc. directly into SVG template strings as `fill` attribute values. While these values come from static `SHIP_OPTIONS` and are safe today, the pattern does not guard against future changes where values might originate from user input. |
| **Recommendation** | Add a defensive color-format validation (e.g., `/^#[0-9a-fA-F]{6}$/`) before interpolation, or document the assumption that these values are trusted constants. |

### 21. Weird string workaround in pixel art pattern

| Detail | Value |
|---|---|
| **File** | `apps/client/src/phaser/game.ts` |
| **Lines** | 187 |
| **Rule violated** | Formatting & Style ("Prefer readable, explicit solutions over clever shortcuts") |
| **Severity** | Minor |
| **Finding** | `"..pttyyyy yyttp..".replace(/ /g, "")` uses a space + runtime `.replace()` as a line-length workaround for a pixel art string. This is a confusing pattern that could be mistaken for a bug. |
| **Recommendation** | Simply concatenate: `"..pttyyyyyyy ttp.."` as a single string, or use string concatenation to break it: `"..pttyyyy" + "yyttp.."`. |

### 22. `loadSession()` returns `null` instead of `undefined`

| Detail | Value |
|---|---|
| **File** | `apps/client/src/storage.ts` |
| **Lines** | 52 |
| **Rule violated** | Vitest instructions ("Never use `null`, always use `undefined` for optional values") — note: technically `applyTo: **/*.js` but the convention is project-wide |
| **Severity** | Minor |
| **Finding** | `loadSession()` returns `StoredSession | null` using `null` as the absent-value sentinel. The project's JS coding guidelines specify `undefined` for optional values. This also propagates `null` checks throughout `app.ts`. |
| **Recommendation** | Change to `parse<StoredSession | undefined>(SESSION_KEY, undefined)` and update the return type. Propagate `undefined` through dependent code in `app.ts`. |

---

## Summary

| Severity | Count |
|---|---|
| Critical | 3 |
| Major | 8 |
| Minor | 11 |
| **Total** | **22** |

### Top Priority Actions
1. **Add runtime input validation** (schema/type guards) for all external inputs (HTTP bodies, WebSocket messages, Redis pub/sub)
2. **Centralize `InputState`** in the shared package to eliminate triple duplication
3. **Rename server files** to kebab-case to match project conventions
4. **Add Vitest test coverage** starting with pure-function game logic modules
5. **Create structured error types** to replace fragile string-based error matching
6. **Add retry/backoff** to client HTTP and WebSocket connections
