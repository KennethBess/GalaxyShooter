## 1. Congratulations Screen Layout

- [x] 1.1 Replace the `"results"` case in `getFrontMarkup` (`apps/client/src/app.ts`) with a congratulations layout — large heading ("Mission Complete!" / "Great Effort!"), animated score display, match stats (mode, stage, duration), player list, and a countdown indicator
- [x] 1.2 Keep existing navigation buttons: "High Scores" and "Back to lobby" (if room is waiting) / "Front page"

## 2. CSS Animations

- [x] 2.1 Add congratulations entrance keyframes in `apps/client/src/style.css` — fade-in + scale for heading, slide-up for stats, glow effect for victory
- [x] 2.2 Add staggered animation delays for heading, score, stats rows, and countdown
- [x] 2.3 Add countdown indicator styling — circular or bar countdown with accent color
- [x] 2.4 Respect `prefers-reduced-motion` — disable all animations when set

## 3. Score Counter Animation

- [x] 3.1 Update `startResultsAnimation` in `app.ts` to work with the new congratulations layout — keep the score counting effect with the same easing

## 4. Auto-Redirect Timer

- [x] 4.1 Add a 10-second countdown timer that starts when the congratulations screen renders — update a visible countdown number every second
- [x] 4.2 When countdown reaches zero, call `clearRegistration()` and `clearSession()`, then transition to `screen: "register"`
- [x] 4.3 Cancel the timer when the user navigates away manually (High Scores, Back to lobby, Front page)

## 5. Cleanup

- [x] 5.1 Remove unused results-specific CSS classes that are no longer needed after the redesign (if any)
