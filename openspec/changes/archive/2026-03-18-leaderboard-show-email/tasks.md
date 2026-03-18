## 1. Shared Types

- [x] 1.1 Add `email: string` to `LeaderboardEntry` interface in `packages/shared/src/index.ts`
- [x] 1.2 Add `email?: string` to `CreateRoomRequest` and `JoinRoomRequest` in `packages/shared/src/index.ts`
- [x] 1.3 Add `email: string` to `PlayerSlot` interface in `packages/shared/src/index.ts`

## 2. Server — Room Service

- [x] 2.1 Update `createRoom` in `apps/server/src/roomService.ts` to accept and store `email` on the host `PlayerSlot` (default to `""`)
- [x] 2.2 Update `joinRoom` in `apps/server/src/roomService.ts` to accept and store `email` on the joining `PlayerSlot`
- [x] 2.3 Update `parseCreateRoomRequest` and `parseJoinRoomRequest` in `apps/server/src/validation.ts` to extract optional `email` field
- [x] 2.4 Update the `POST /rooms` and `POST /rooms/:code/join` route handlers in `apps/server/src/index.ts` to pass `email` through

## 3. Server — Leaderboard

- [x] 3.1 Add `email: string` to `LeaderboardSubmission` interface in `apps/server/src/leaderboardRepository.ts`
- [x] 3.2 Store `email` in the Redis hash and read it back in `RedisLeaderboardRepository`
- [x] 3.3 Store `email` in the in-memory entry in `InMemoryLeaderboardRepository`
- [x] 3.4 Update `matchService.ts` to read the host player's `email` from the player slot and include it in the leaderboard submission

## 4. Client

- [x] 4.1 Update `createRoom` and `joinRoom` calls in `apps/client/src/app.ts` to send the registered email from `this.registration`
- [x] 4.2 Display email on each leaderboard entry row in `renderLeaderboardBody` — show below player name in muted style

## 5. Tests

- [x] 5.1 Update existing leaderboard tests to include `email` in submissions
- [x] 5.2 Add test: leaderboard entry includes email after submission
