## 1. Shared Types and Validation

- [x] 1.1 Add player registration types to `packages/shared/src/index.ts` (RegisterRequest, RegisterResponse, PlayerRecord)
- [x] 1.2 Add Zod validation schema for registration input (fullName required max 100, email required valid format, phone optional max 20)

## 2. Server — Player Repository

- [x] 2.1 Create `apps/server/src/playerRepository.ts` with Redis Hash storage (player:{id}), Set index (players:all), and email index (players:email:{email})
- [x] 2.2 Implement `register()` — check email index for duplicates, create Hash + update indexes, return player ID
- [x] 2.3 Implement `getById()` and `getByEmail()` lookups
- [x] 2.4 Implement `getAll()` — scan players:all Set, fetch all Hashes

## 3. Server — REST Endpoints

- [x] 3.1 Add `POST /register` endpoint in `index.ts` — validate with Zod, call playerRepository.register(), return player ID
- [x] 3.2 Add `GET /players/export` endpoint — call playerRepository.getAll(), format as RFC 4180 CSV, return with correct headers
- [x] 3.3 Wire playerRepository into the server startup (pass Redis client from roomManagerFactory)

## 4. Client — Registration Screen

- [x] 4.1 Add `"register"` screen to client state machine in `app.ts` — gate on localStorage token presence
- [x] 4.2 Build registration form HTML (full name, email, phone inputs with validation feedback)
- [x] 4.3 Add `POST /register` API call in `api.ts`, store returned player ID in localStorage
- [x] 4.4 On successful registration, transition to lobby screen and pre-fill pilot name from registered full name

## 5. Client — Styling

- [x] 5.1 Style the registration form to match existing lobby UI (dark space theme, consistent input/button styles)

## 6. Testing

- [x] 6.1 Add server tests for playerRepository (register, duplicate email, getAll)
- [x] 6.2 Add server tests for POST /register and GET /players/export endpoints
- [x] 6.3 Verify CSV output escaping for fields with commas and quotes
