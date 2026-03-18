## 1. Registration Screen Markup

- [x] 1.1 Add a "Leaderboard" button below the registration form in the `"register"` case of `getFrontMarkup` in `apps/client/src/app.ts`

## 2. Navigation Handler

- [x] 2.1 Add a click handler for the leaderboard button on the registration screen — set `previousScreen` to `"register"`, transition to scores screen, and load leaderboard
- [x] 2.2 Update the `#back-from-scores` handler to return to `"register"` screen when `previousScreen === "register"`

## 3. Type Update

- [x] 3.1 Update the `previousScreen` type to include `"register"` if it's currently typed as a string union
