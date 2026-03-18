## Purpose

Animated post-match congratulations screen that celebrates the player's result and auto-redirects to the registration screen after 10 seconds.

## Requirements

### Requirement: Congratulations screen replaces results screen after match end
When a match ends, the client SHALL display an animated congratulations screen instead of the current results screen. The screen SHALL show the match outcome (victory or defeat), the team score, and a celebratory message.

#### Scenario: Victory congratulations
- **WHEN** a match ends with outcome "victory"
- **THEN** the congratulations screen displays a victory message (e.g., "Mission Complete!") with the final score

#### Scenario: Defeat congratulations
- **WHEN** a match ends with outcome "defeat"
- **THEN** the congratulations screen displays an encouraging message (e.g., "Great Effort!") with the final score

---

### Requirement: Congratulations screen has animated entrance
The congratulations screen SHALL animate in with a visually celebratory entrance. The score SHALL count up from zero to the final value. Elements SHALL stagger in sequentially.

#### Scenario: Score counter animation
- **WHEN** the congratulations screen renders
- **THEN** the score number animates from 0 to the final score over approximately 1.5 seconds

#### Scenario: Staggered element entrance
- **WHEN** the congratulations screen renders
- **THEN** the heading, score, stats, and countdown appear sequentially with staggered delays

#### Scenario: Reduced motion preference
- **WHEN** the user has `prefers-reduced-motion: reduce` enabled
- **THEN** all animations are skipped and content appears immediately

---

### Requirement: Auto-redirect to registration after 10 seconds
The congratulations screen SHALL automatically redirect the player to the registration screen after 10 seconds. A visible countdown indicator SHALL show the remaining time.

#### Scenario: Countdown timer visible
- **WHEN** the congratulations screen is displayed
- **THEN** a countdown showing the seconds remaining (10, 9, 8... 1) is visible on screen

#### Scenario: Auto-redirect triggers at zero
- **WHEN** the countdown reaches zero
- **THEN** the client clears the player's registration and session data
- **AND** transitions to the registration screen

#### Scenario: Player can navigate away before timer expires
- **WHEN** the player clicks "High Scores" or "Back to lobby" before the countdown ends
- **THEN** the timer is cancelled and the player navigates to the chosen screen

---

### Requirement: Session cleared on redirect
When the auto-redirect fires, the client SHALL clear the stored registration and session data so the next user must register fresh.

#### Scenario: Registration and session cleared
- **WHEN** the 10-second timer fires and the player is redirected
- **THEN** `clearRegistration()` and `clearSession()` are called
- **AND** the registration screen is shown with a fresh form
