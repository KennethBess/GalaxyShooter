import { DEFAULT_SHIP_ID, type GameMode, type LeaderboardEntry, type OpenRoomSummary, type ResultSummary, ROOM_CODE_LENGTH, type RoomState, type ServerMessage, SHIP_OPTIONS, type ShipId, type SnapshotState } from "@shared/index";
import QRCode from "qrcode";
import { createRoom, deleteLeaderboardEntry, fetchLeaderboard, joinRoom, listOpenRooms, registerPlayer, resetLeaderboard } from "./api";
import { RoomConnection } from "./network";
import { createGame } from "./phaser/game";
import { clearRegistration, clearSession, loadRegistration, loadScores, loadSession, loadSettings, saveRegistration, type StoredSession, saveScore, saveSession, saveSettings } from "./storage";
import { heroBannerSvg, shipLabel, shipPreviewSvg } from "./templates";

interface AppState {
  screen: "register" | "home" | "lobby" | "game" | "results" | "scores" | "settings";
  room: RoomState | null;
  snapshot: SnapshotState | null;
  result: ResultSummary | null;
  notice: string;
  busy: boolean;
  eventLog: { kind: string; text: string }[];
  openRooms: OpenRoomSummary[];
  roomsBusy: boolean;
  leaderboardRank: number | null;
  leaderboardMode: GameMode;
  leaderboardEntries: LeaderboardEntry[];
  leaderboardLoading: boolean;
  leaderboardError: string | null;
  previousScreen: "home" | "results" | "register";
}

export class App {
  private readonly gameHost = (() => {
    const host = document.createElement("div");
    host.className = "game-canvas";
    return host;
  })();
  private readonly game = createGame(this.gameHost, (input) => this.connection?.send({ type: "input", payload: input }), () => this.connection?.send({ type: "use_bomb" }));
  private readonly settings = (() => {
    const s = loadSettings();
    this.game.setMusicVolume(s.musicVolume, s.musicMuted);
    return s;
  })();
  private connection: RoomConnection | null = null;
  private session: StoredSession | null = loadSession();
  private selectedShip: ShipId = this.session?.shipId ?? DEFAULT_SHIP_ID;
  private homeMode: "create" | "join" = "create";
  private eventAbort: AbortController | null = null;
  private renderedFeedCount = 0;
  private registration = loadRegistration();
  private congratsTimer: ReturnType<typeof setInterval> | null = null;
  private state: AppState = {
    screen: loadRegistration() ? "home" : "register",
    room: null,
    snapshot: null,
    result: null,
    notice: "Create a room or join with a code.",
    busy: false,
    eventLog: [],
    openRooms: [],
    roomsBusy: false,
    leaderboardRank: null,
    leaderboardMode: "campaign",
    leaderboardEntries: [],
    leaderboardLoading: false,
    leaderboardError: null,
    previousScreen: "home"
  };

  constructor(private readonly root: HTMLElement) {
    void this.tryReconnect();
    this.render();
  }

  private render() {
    const room = this.state.room;
    const players = room?.players ?? [];
    const playerName = this.session?.playerName ?? this.registration?.fullName ?? "";
    const myPlayer = players.find((player) => player.playerId === this.session?.playerId);
    const scores = loadScores();

    this.root.className = `app-root screen-${this.state.screen}`;
    document.documentElement.classList.toggle("game-active", this.state.screen === "game");
    this.root.innerHTML = this.state.screen === "game"
      ? this.getGameMarkup(room)
      : this.getFrontMarkup(room, players, myPlayer, playerName, scores);

    document.title = this.getScreenTitle();
    this.mountGameHost();
    this.bindEvents();
    this.syncShipPickerSelection();
    if (this.state.screen === "game") {
      this.refreshGamePanel();
    }
    const main = this.root.querySelector<HTMLElement>("#maincontent");
    main?.focus({ preventScroll: true });
    if (this.state.screen === "results") {
      this.startResultsAnimation();
    }
    if (this.state.screen === "lobby") {
      this.renderQrCode("lobby-qr");
    }
    if (this.state.screen === "game") {
      this.renderQrCode("game-qr");
    }
    this.game.playMusic(this.state.screen === "game" ? "battle" : "lobby");
  }

  private startResultsAnimation() {
    this.clearCongratsTimer();
    const el = this.root.querySelector<HTMLElement>("#results-score");
    if (!el) return;
    const target = Number(el.dataset.target ?? 0);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = String(target);
    } else {
      const duration = 1500;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - (1 - t) * (1 - t);
        el.textContent = String(Math.round(eased * target));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    this.startCongratsCountdown();
  }

  private startCongratsCountdown() {
    let remaining = 10;
    const timerEl = this.root.querySelector<HTMLElement>("#congrats-timer");
    if (timerEl) timerEl.textContent = String(remaining);
    this.congratsTimer = setInterval(() => {
      remaining--;
      const el = this.root.querySelector<HTMLElement>("#congrats-timer");
      if (el) el.textContent = String(remaining);
      if (remaining <= 0) {
        this.clearCongratsTimer();
        clearRegistration();
        clearSession();
        this.connection?.disconnect();
        this.connection = null;
        this.session = null;
        this.registration = null;
        this.state = {
          screen: "register",
          room: null,
          snapshot: null,
          result: null,
          notice: "",
          busy: false,
          eventLog: [],
          openRooms: [],
          roomsBusy: false,
          leaderboardRank: null,
          leaderboardMode: "campaign",
          leaderboardEntries: [],
          leaderboardLoading: false,
          leaderboardError: null,
          previousScreen: "home"
        };
        this.game.clear();
        this.render();
      }
    }, 1000);
  }

  private clearCongratsTimer() {
    if (this.congratsTimer) {
      clearInterval(this.congratsTimer);
      this.congratsTimer = null;
    }
  }

  private mountGameHost() {
    const gameRoot = this.root.querySelector(".game-root") as HTMLDivElement | null;
    if (gameRoot && this.gameHost.parentElement !== gameRoot) {
      gameRoot.replaceChildren(this.gameHost);
    }
  }

  private getFrontMarkup(
    room: RoomState | null,
    players: RoomState["players"],
    myPlayer: RoomState["players"][number] | undefined,
    playerName: string,
    scores: ReturnType<typeof loadScores>
  ) {
    switch (this.state.screen) {
      case "register":
        return `
          <main id="maincontent" tabindex="-1" class="front-page landing-page screen-enter">
            <div class="landing-grid">
              <section class="hero landing-hero">
                <div class="hero-art" aria-hidden="true">${heroBannerSvg()}</div>
                <div class="landing-copy">
                  <p class="eyebrow">Player Registration</p>
                  <h1>Galaxy Shooter</h1>
                  <p class="lede">Register to join the action. Your pilot name will be pre-filled from your full name.</p>
                </div>
                <div class="landing-support">
                  <div class="notice-banner" role="status" aria-live="polite">${this.escape(this.state.notice)}</div>
                </div>
              </section>
              <section class="front-card landing-panel">
                <form id="register-form" class="stack compact-stack">
                  <label for="reg-fullname" class="sr-only">Full name</label>
                  <input id="reg-fullname" name="fullName" maxlength="100" placeholder="Full name" required />
                  <label for="reg-email" class="sr-only">Email address</label>
                  <input id="reg-email" name="email" type="email" placeholder="Email address" required />
                  <label for="reg-phone" class="sr-only">Phone number (optional)</label>
                  <input id="reg-phone" name="phone" maxlength="20" placeholder="Phone number (optional)" />
                  <button type="submit" class="primary-button" ${this.state.busy ? "disabled" : ""}>Register &amp; Play</button>
                </form>
              </section>
            </div>
          </main>
        `;
      case "home":
        return `
          <main id="maincontent" tabindex="-1" class="front-page landing-page screen-enter">
            <div class="landing-grid">
              <section class="hero landing-hero">
                <div class="hero-art" aria-hidden="true">${heroBannerSvg()}</div>
                <div class="landing-copy">
                  <p class="eyebrow">Browser Co-op Shmup</p>
                  <h1>Galaxy Shooter</h1>
                  <p class="lede">Create a squad room, share the code, and push through campaign bosses or survival together.</p>
                </div>
                <div class="landing-support">
                  <div class="notice-banner" role="status" aria-live="polite">${this.escape(this.state.notice)}</div>
                  <div class="hero-meta">
                    <span>Up to 4 players</span>
                    <span>Room code join</span>
                    <span>Campaign + Survival</span>
                  </div>
                </div>
              </section>
              <section class="front-card landing-panel">
                <div class="mode-switch" role="tablist" aria-label="Room action">
                  <button id="switch-create" class="mode-pill ${this.homeMode === "create" ? "active" : ""}" type="button" role="tab" aria-selected="${this.homeMode === "create"}" aria-controls="create-form">Create Room</button>
                  <button id="switch-join" class="mode-pill ${this.homeMode === "join" ? "active" : ""}" type="button" role="tab" aria-selected="${this.homeMode === "join"}" aria-controls="join-form">Join Room</button>
                </div>
                <form id="${this.homeMode}-form" role="tabpanel" class="stack compact-stack">
                  <label for="pilot-name" class="sr-only">Pilot name</label>
                  <input id="pilot-name" name="playerName" maxlength="16" placeholder="Pilot name" value="${this.escape(playerName)}" required />
                  ${this.homeMode === "join" ? '<label for="room-code" class="sr-only">Game code</label><input id="room-code" name="roomCode" maxlength="5" placeholder="Game code" style="text-transform:uppercase" required />' : ""}
                  ${this.renderShipPicker(`${this.homeMode}-ship-id`)}
                  ${this.homeMode === "join" ? this.renderOpenRooms() : ""}
                  <button type="submit" class="primary-button" ${this.state.busy ? "disabled" : ""}>${this.homeMode === "create" ? "Generate room code" : "Join squad"}</button>
                </form>
                <div class="utility-actions">
                  <button id="show-leaderboard" class="secondary-button">Leaderboard</button>
                  <button id="show-settings" class="secondary-button">Settings</button>
                  <button id="switch-player" class="ghost-button">Switch Player</button>
                </div>
              </section>
            </div>
          </main>
        `;
      case "lobby":
        return `
          <main id="maincontent" tabindex="-1" class="front-page lobby-page screen-enter">
            <div class="lobby-grid">
              <header class="hero lobby-hero">
                <p class="eyebrow">Squad Lobby</p>
                <h1>${room?.roomCode ?? "-----"}</h1>
                <p class="lede">Share this code. After everyone joins, click start game to move into the play screen.</p>
                <div class="lobby-meta">
                  <div class="lobby-stat">
                    <span class="lobby-stat-label">Pilots</span>
                    <strong id="lobby-pilots">${players.length}/4</strong>
                  </div>
                  <div class="lobby-stat">
                    <span class="lobby-stat-label">Mode</span>
                    <strong id="lobby-mode">${room?.mode === "survival" ? "Survival" : "Campaign"}</strong>
                  </div>
                  <div class="lobby-stat">
                    <span class="lobby-stat-label">Host</span>
                    <strong id="lobby-host">${this.escape(players.find((player) => player.isHost)?.name ?? "-")}</strong>
                  </div>
                </div>
                <div id="lobby-notice" class="notice-banner" role="status" aria-live="polite">${this.escape(this.state.notice)}</div>
              </header>
              <section class="front-card lobby-panel">
                <div class="lobby-panel-top">
                  <div class="stack small-gap">
                    <label for="mode-select">Mode</label>
                    <select id="mode-select" ${myPlayer?.isHost ? "" : "disabled"}>
                      <option value="campaign" ${room?.mode === "campaign" ? "selected" : ""}>Campaign</option>
                      <option value="survival" ${room?.mode === "survival" ? "selected" : ""}>Survival</option>
                    </select>
                  </div>
                  <p class="lobby-panel-hint">${myPlayer?.isHost
                    ? "You are the host. Set the mode and launch when the squad is ready."
                    : "Waiting for the host to launch the run. You can ready up below."}</p>
                </div>
                <div class="lobby-section-heading">
                  <h2>Squad</h2>
                  <span id="lobby-online">${players.filter((player) => player.connected).length} online</span>
                </div>
                <ul id="lobby-roster" class="roster lobby-roster">
                  ${players.map((player) => `<li>
                    <span class="lobby-roster-name">
                      <span>${this.escape(player.name)}</span>
                      <span class="lobby-chip">${this.escape(shipLabel(player.shipId))}</span>
                      ${player.isHost ? '<span class="lobby-chip lobby-chip-host">Host</span>' : ""}
                    </span>
                    <span class="lobby-roster-status ${player.connected ? "is-online" : "is-reconnecting"}">${player.connected ? "Online" : "Reconnecting"}${player.ready ? " / Ready" : ""}</span>
                  </li>`).join("")}
                </ul>
                <div class="lobby-actions">
                  ${myPlayer?.isHost
                    ? `<button id="start-match" class="primary-button">Start game</button>`
                    : `<button id="toggle-ready" class="secondary-button">${myPlayer?.ready ? "Unready" : "Ready up"}</button>`}
                  <button id="leave-room" class="ghost-button">Leave room</button>
                </div>
                <div class="controller-qr-section">
                  <h2>Mobile Controller</h2>
                  <p class="controller-qr-hint">Scan with your phone to use it as a gamepad</p>
                  <div id="lobby-qr" class="controller-qr-container"></div>
                </div>
              </section>
            </div>
          </main>
        `;
      case "results": {
        const outcome = this.state.result?.outcome === "victory";
        const finalScore = this.state.result?.score ?? 0;
        return `
          <main id="maincontent" tabindex="-1" class="front-page congrats-page screen-enter">
            <div class="congrats-shell">
              <div class="congrats-heading congrats-anim" style="animation-delay:0ms">
                <p class="eyebrow">${outcome ? "Mission Complete!" : "Great Effort!"}</p>
                <h1 id="results-score" class="congrats-score ${outcome ? "congrats-win-glow" : ""}" data-target="${finalScore}">0</h1>
                <p class="congrats-subtitle">${this.escape(this.state.notice)}</p>
              </div>
              <div class="congrats-stats congrats-anim" style="animation-delay:300ms">
                <div class="congrats-stat"><span class="congrats-stat-label">Mode</span><span class="congrats-stat-value">${this.escape(this.state.result?.mode ?? "-")}</span></div>
                <div class="congrats-stat"><span class="congrats-stat-label">Stage</span><span class="congrats-stat-value">${this.state.result?.stageReached ?? 0}</span></div>
                <div class="congrats-stat"><span class="congrats-stat-label">Duration</span><span class="congrats-stat-value">${Math.round((this.state.result?.durationMs ?? 0) / 1000)}s</span></div>
              </div>
              <ul class="congrats-players congrats-anim" style="animation-delay:500ms">
                ${(this.state.result?.players ?? []).map((player) => `<li><span>${this.escape(player.name)} (${this.escape(shipLabel(player.shipId))})</span><span>${player.score.toLocaleString()}</span></li>`).join("")}
              </ul>
              <div class="congrats-countdown congrats-anim" style="animation-delay:700ms">
                <span id="congrats-timer">10</span>s until next session
              </div>
              <div class="lobby-actions congrats-anim" style="animation-delay:700ms">
                ${room?.status === "waiting" ? '<button id="back-lobby" class="secondary-button">Back to lobby</button>' : ""}
                <button id="show-scores" class="secondary-button">High Scores</button>
              </div>
            </div>
          </main>
        `;
      }
      case "scores":
        return `
          <main id="maincontent" tabindex="-1" class="front-page lb-page screen-enter">
            <div class="lb-container">
              <header class="lb-header">
                <p class="eyebrow">Global Rankings</p>
                <h1>Leaderboard</h1>
              </header>
              <div class="lb-tabs" role="tablist" aria-label="Leaderboard mode">
                <button class="lb-tab ${this.state.leaderboardMode === "campaign" ? "active" : ""}" role="tab" aria-selected="${this.state.leaderboardMode === "campaign"}" data-lb-mode="campaign">Campaign</button>
                <button class="lb-tab ${this.state.leaderboardMode === "survival" ? "active" : ""}" role="tab" aria-selected="${this.state.leaderboardMode === "survival"}" data-lb-mode="survival">Survival</button>
              </div>
              <section class="lb-body">
                ${this.renderLeaderboardBody()}
              </section>
              ${new URLSearchParams(window.location.search).has("admin") ? '<button id="lb-reset" class="secondary-button lb-reset-btn">Reset Scores</button>' : ""}
              <button id="back-from-scores" class="secondary-button lb-back">Back</button>
            </div>
          </main>
        `;
      case "settings":
        return `
          <main id="maincontent" tabindex="-1" class="front-page screen-enter">
            <div class="front-shell compact-shell">
              <header class="hero compact-hero">
                <p class="eyebrow">Local preferences</p>
                <h1>Settings</h1>
              </header>
              <section class="front-card stack">
                <label class="toggle"><input id="setting-shake" type="checkbox" ${this.settings.screenshake ? "checked" : ""} /> Screen shake</label>
                <label class="toggle"><input id="setting-flash" type="checkbox" ${this.settings.reducedFlash ? "checked" : ""} /> Reduced flash</label>
                <label class="toggle"><input id="setting-mute" type="checkbox" ${this.settings.musicMuted ? "checked" : ""} /> Mute music</label>
                <label class="setting-range-label">Music volume
                  <input id="setting-volume" type="range" min="0" max="1" step="0.05" value="${this.settings.musicVolume}" />
                </label>
                <div class="lobby-actions">
                  <button id="back-home" class="primary-button">Front page</button>
                </div>
              </section>
            </div>
          </main>
        `;
      default:
        return "";
    }
  }

  private renderLeaderboardBody() {
    if (this.state.leaderboardLoading) {
      return '<div class="lb-status"><div class="lb-spinner"></div><p>Loading scores...</p></div>';
    }
    if (this.state.leaderboardError) {
      return `<div class="lb-status"><p>${this.escape(this.state.leaderboardError)}</p><button id="lb-retry" class="secondary-button">Retry</button></div>`;
    }
    if (this.state.leaderboardEntries.length === 0) {
      return '<div class="lb-status"><p>No scores yet — be the first!</p></div>';
    }
    const highlightRank = this.state.previousScreen === "results" ? this.state.leaderboardRank : null;
    const medals = ["", "\u{1F947}", "\u{1F948}", "\u{1F949}"];
    const rows = this.state.leaderboardEntries.map((entry, i) => {
      const rank = i + 1;
      const tierClass = rank <= 3 ? `lb-tier-${rank}` : "";
      const highlightClass = rank === highlightRank ? "lb-highlight" : "";
      const date = new Date(entry.achievedAt).toLocaleDateString();
      const badge = rank <= 3 ? `<span class="lb-medal">${medals[rank]}</span>` : `<span class="lb-rank-num">${rank}</span>`;
      return `<div class="lb-entry ${tierClass} ${highlightClass}" style="animation-delay:${i * 50}ms">
        <div class="lb-rank-cell">${badge}</div>
        <div class="lb-info">
          <span class="lb-pilot">${this.escape(entry.playerName)}</span>
          <span class="lb-meta">Stage ${entry.stageReached} · ${date}</span>
        </div>
        <div class="lb-score-cell">${entry.score.toLocaleString()}</div>
        <button class="lb-remove" data-lb-delete="${entry.id}" title="Remove entry">&times;</button>
      </div>`;
    }).join("");
    return `<div class="lb-list">${rows}</div>`;
  }

  private async loadLeaderboard(mode: GameMode) {
    this.state.leaderboardMode = mode;
    this.state.leaderboardLoading = true;
    this.state.leaderboardError = null;
    this.state.leaderboardEntries = [];
    this.render();
    try {
      this.state.leaderboardEntries = await fetchLeaderboard(mode);
    } catch (error) {
      this.state.leaderboardError = error instanceof Error ? error.message : "Failed to load leaderboard";
    } finally {
      this.state.leaderboardLoading = false;
      this.render();
    }
  }

  private getGameMarkup(room: RoomState | null) {
    return `
      <main id="maincontent" tabindex="-1" class="game-page screen-enter">
        <header class="game-header">
          <div>
            <p class="eyebrow">Galaxy Shooter</p>
            <h1>${this.escape(room?.roomCode ?? "")}</h1>
          </div>
          <div class="game-header-actions">
            <div class="game-stat-pill">Stage <span id="game-stage"></span></div>
            <div class="game-stat-pill">Score <span id="game-score"></span></div>
            <div class="game-stat-pill">Lives <span id="game-lives"></span></div>
            <button id="leave-room" class="ghost-button">Leave game</button>
          </div>
        </header>
        <section class="game-layout">
          <div class="game-stage-shell">
            <div class="game-root" role="application" aria-label="Game canvas"></div>
          </div>
          <aside class="game-sidebar">
            <section class="game-card">
              <h2>Squad</h2>
              <ul id="game-roster" class="roster compact-roster"></ul>
            </section>
            <section class="game-card">
              <h2>Combat Feed</h2>
              <ul id="game-feed" class="feed" aria-live="polite" aria-relevant="additions"></ul>
            </section>
            <section class="game-card controller-qr-game">
              <details>
                <summary>Mobile Controller</summary>
                <div id="game-qr" class="controller-qr-container"></div>
              </details>
            </section>
          </aside>
        </section>
      </main>
    `;
  }

  private renderShipPicker(groupName: string) {
    return `
      <fieldset class="ship-grid-fieldset">
        <legend class="sr-only">Choose your ship</legend>
        <div class="ship-grid">
          ${SHIP_OPTIONS.map((ship) => `
            <label class="ship-option ${ship.id === this.selectedShip ? "selected" : ""}">
              <input type="radio" class="sr-only" data-ship-input name="${groupName}" value="${ship.id}" ${ship.id === this.selectedShip ? "checked" : ""} />
              <span class="ship-option-preview" aria-hidden="true">${shipPreviewSvg(ship.id)}</span>
              <span class="ship-option-name">${ship.label}</span>
            </label>
          `).join("")}
        </div>
      </fieldset>
    `;
  }

  private renderOpenRooms() {
    const roomsMarkup = this.state.roomsBusy
      ? '<p class="open-rooms-empty">Loading open rooms...</p>'
      : this.state.openRooms.length === 0
        ? '<p class="open-rooms-empty">No open rooms right now. Enter a code manually or create a new room.</p>'
        : this.state.openRooms.map((room) =>             `<button type="button" class="open-room-card" data-join-room-code="${room.roomCode}">
              <span class="open-room-main">
                <strong>${room.roomCode}</strong>
                <span>${this.escape(room.hostName)} hosting ${room.mode === "survival" ? "Survival" : "Campaign"}</span>
              </span>
              <span class="open-room-meta">${room.playerCount}/${room.maxPlayers} pilots</span>
            </button>`)
          .join("");

    return       `<section class="open-rooms-panel">
        <div class="open-rooms-header">
          <h2>Open Rooms</h2>
          <button id="refresh-open-rooms" type="button" class="ghost-button" ${this.state.roomsBusy ? "disabled" : ""}>Refresh</button>
        </div>
        <div class="open-rooms-list">${roomsMarkup}</div>
      </section>`;
  }

  private syncShipPickerSelection() {
    this.root.querySelectorAll<HTMLInputElement>("[data-ship-input]").forEach((input) => {
      input.checked = input.value === this.selectedShip;
      input.closest(".ship-option")?.classList.toggle("selected", input.checked);
    });
  }

  private refreshGamePanel() {
    if (this.state.screen !== "game") {
      return;
    }

    const stage = this.root.querySelector("#game-stage");
    const score = this.root.querySelector("#game-score");
    const lives = this.root.querySelector("#game-lives");
    const roster = this.root.querySelector("#game-roster");
    const feed = this.root.querySelector("#game-feed");

    if (stage) {
      stage.textContent = this.state.snapshot?.stageLabel ?? this.state.room?.mode ?? "-";
    }
    if (score) {
      score.textContent = String(this.state.snapshot?.score ?? 0);
    }
    if (lives) {
      lives.textContent = String(this.state.snapshot?.teamLives ?? this.state.room?.teamLives ?? 0);
    }
    if (roster) {
      const nextRosterMarkup = (this.state.snapshot?.players ?? [])
        .map((player) => `<li><span>${this.escape(player.name)} (${this.escape(shipLabel(player.shipId))})</span><span>${player.alive ? `score ${player.score}` : "down"}</span></li>`)
        .join("");
      if (roster.innerHTML !== nextRosterMarkup) {
        roster.innerHTML = nextRosterMarkup;
      }
    }
    if (feed) {
      const feedKindClass: Record<string, string> = {
        player_hit: "feed-hit", player_respawn: "feed-respawn",
        boss_phase: "feed-boss", boss_defeated: "feed-boss",
        stage_clear: "feed-stage", pickup: "feed-pickup", info: "feed-info"
      };
      // Reset rendered count when the feed element is freshly created (after a render())
      if (feed.children.length === 0) {
        this.renderedFeedCount = 0;
      }
      if (this.state.eventLog.length === 0 && feed.children.length === 0) {
        const placeholder = document.createElement("li");
        placeholder.textContent = "Hold formation.";
        feed.appendChild(placeholder);
      } else if (this.state.eventLog.length > this.renderedFeedCount) {
        // Remove placeholder if present
        if (feed.children.length === 1 && feed.firstElementChild?.textContent === "Hold formation.") {
          feed.firstElementChild.remove();
        }
        // eventLog is prepended (newest first); append only entries not yet rendered
        const newEntries = this.state.eventLog.slice(0, this.state.eventLog.length - this.renderedFeedCount);
        for (const entry of newEntries.reverse()) {
          const li = document.createElement("li");
          li.className = feedKindClass[entry.kind] ?? "feed-info";
          li.textContent = entry.text;
          feed.prepend(li);
        }
        // Remove overflow beyond max kept entries
        while (feed.children.length > this.state.eventLog.length) {
          feed.lastElementChild?.remove();
        }
        this.renderedFeedCount = this.state.eventLog.length;
      }
    }
  }

  private refreshLobbyPanel() {
    if (this.state.screen !== "lobby") {
      return;
    }
    const room = this.state.room;
    const players = room?.players ?? [];

    const pilots = this.root.querySelector("#lobby-pilots");
    const mode = this.root.querySelector("#lobby-mode");
    const host = this.root.querySelector("#lobby-host");
    const notice = this.root.querySelector("#lobby-notice");
    const online = this.root.querySelector("#lobby-online");
    const roster = this.root.querySelector("#lobby-roster");

    if (pilots) pilots.textContent = `${players.length}/4`;
    if (mode) mode.textContent = room?.mode === "survival" ? "Survival" : "Campaign";
    if (host) host.textContent = this.escape(players.find((p) => p.isHost)?.name ?? "-");
    if (notice) notice.textContent = this.state.notice;
    if (online) online.textContent = `${players.filter((p) => p.connected).length} online`;

    if (roster) {
      const nextRosterMarkup = players.map((player) => `<li>
                    <span class="lobby-roster-name">
                      <span>${this.escape(player.name)}</span>
                      <span class="lobby-chip">${this.escape(shipLabel(player.shipId))}</span>
                      ${player.isHost ? '<span class="lobby-chip lobby-chip-host">Host</span>' : ""}
                    </span>
                    <span class="lobby-roster-status ${player.connected ? "is-online" : "is-reconnecting"}">${player.connected ? "Online" : "Reconnecting"}${player.ready ? " / Ready" : ""}</span>
                  </li>`).join("");
      if (roster.innerHTML !== nextRosterMarkup) {
        roster.innerHTML = nextRosterMarkup;
      }
    }
  }

  private bindEvents() {
    this.eventAbort?.abort();
    this.eventAbort = new AbortController();
    const { signal } = this.eventAbort;

    const registerForm = this.root.querySelector("#register-form") as HTMLFormElement | null;
    registerForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(registerForm);
      await this.handleRegister(
        String(form.get("fullName") ?? ""),
        String(form.get("email") ?? ""),
        String(form.get("phone") ?? "")
      );
    }, { signal });

    const activeForm = this.root.querySelector(`#${this.homeMode}-form`) as HTMLFormElement | null;
    activeForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(activeForm);
      if (this.homeMode === "create") {
        await this.handleCreate(String(form.get("playerName") ?? ""), String(form.get("create-ship-id") ?? this.selectedShip));
        return;
      }
      await this.handleJoin(
        String(form.get("playerName") ?? ""),
        String(form.get("roomCode") ?? ""),
        String(form.get("join-ship-id") ?? this.selectedShip)
      );
    }, { signal });

    this.root.querySelector("#switch-create")?.addEventListener("click", () => {
      this.homeMode = "create";
      this.render();
    }, { signal });
    this.root.querySelector("#switch-join")?.addEventListener("click", () => {
      this.homeMode = "join";
      this.render();
      void this.refreshOpenRooms();
    }, { signal });

    this.root.querySelectorAll<HTMLInputElement>("[data-ship-input]").forEach((input) => {
      input.addEventListener("change", () => {
        this.selectedShip = input.value as ShipId;
        this.syncShipPickerSelection();
      }, { signal });
    });

    this.root.querySelector<HTMLInputElement>("input[name=\"roomCode\"]")?.addEventListener("input", (event) => {
      const input = event.target as HTMLInputElement;
      input.value = this.normalizeRoomCode(input.value);
    }, { signal });

    this.root.querySelector("#refresh-open-rooms")?.addEventListener("click", () => {
      void this.refreshOpenRooms();
    }, { signal });
    this.root.querySelectorAll<HTMLElement>("[data-join-room-code]").forEach((button) => {
      button.addEventListener("click", () => {
        void this.handleJoinFromListing(button.dataset.joinRoomCode ?? "");
      }, { signal });
    });

    this.root.querySelector("#switch-player")?.addEventListener("click", () => {
      clearRegistration();
      this.registration = null;
      this.session = null;
      clearSession();
      this.state.screen = "register";
      this.state.notice = "Register a new player.";
      this.render();
    }, { signal });
    this.root.querySelector("#show-leaderboard")?.addEventListener("click", () => {
      this.state.previousScreen = "home";
      this.state.leaderboardRank = null;
      this.state.screen = "scores";
      void this.loadLeaderboard(this.state.leaderboardMode);
    }, { signal });
    this.root.querySelector("#show-scores")?.addEventListener("click", () => {
      this.clearCongratsTimer();
      this.state.previousScreen = "results";
      this.state.leaderboardMode = this.state.result?.mode ?? "campaign";
      this.state.screen = "scores";
      void this.loadLeaderboard(this.state.leaderboardMode);
    }, { signal });
    this.root.querySelector("#show-settings")?.addEventListener("click", () => {
      this.state.screen = "settings";
      this.render();
    }, { signal });
    this.root.querySelector("#back-home")?.addEventListener("click", () => this.resetToHome(), { signal });
    this.root.querySelector("#back-from-scores")?.addEventListener("click", () => {
      if (this.state.previousScreen === "results" && this.state.result) {
        this.state.screen = "results";
        this.render();
      } else {
        this.resetToHome();
      }
    }, { signal });
    this.root.querySelectorAll<HTMLElement>("[data-lb-mode]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const mode = tab.dataset.lbMode as GameMode;
        if (mode !== this.state.leaderboardMode) {
          void this.loadLeaderboard(mode);
        }
      }, { signal });
    });
    this.root.querySelector("#lb-retry")?.addEventListener("click", () => {
      void this.loadLeaderboard(this.state.leaderboardMode);
    }, { signal });
    this.root.querySelectorAll<HTMLElement>("[data-lb-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.lbDelete!;
        if (!confirm("Remove this score?")) return;
        void (async () => {
          try {
            await deleteLeaderboardEntry(id);
            await this.loadLeaderboard(this.state.leaderboardMode);
          } catch (error) {
            this.state.leaderboardError = error instanceof Error ? error.message : "Failed to delete entry";
            this.render();
          }
        })();
      }, { signal });
    });
    this.root.querySelector("#lb-reset")?.addEventListener("click", () => {
      if (!confirm(`Reset all ${this.state.leaderboardMode} scores? This cannot be undone.`)) return;
      void (async () => {
        try {
          await resetLeaderboard(this.state.leaderboardMode);
          void this.loadLeaderboard(this.state.leaderboardMode);
        } catch (error) {
          this.state.leaderboardError = error instanceof Error ? error.message : "Reset failed";
          this.state.leaderboardEntries = [];
          this.render();
        }
      })();
    }, { signal });
    this.root.querySelector("#back-lobby")?.addEventListener("click", () => this.backToLobby(), { signal });
    this.root.querySelector("#leave-room")?.addEventListener("click", () => this.leaveRoom(), { signal });
    this.root.querySelector("#toggle-ready")?.addEventListener("click", () => {
      const current = this.state.room?.players.find((player) => player.playerId === this.session?.playerId);
      this.connection?.send({ type: "ready", payload: { ready: !(current?.ready ?? false) } });
    }, { signal });
    this.root.querySelector("#start-match")?.addEventListener("click", () => this.connection?.send({ type: "start_match" }), { signal });
    this.root.querySelector("#mode-select")?.addEventListener("change", (event) => {
      const next = (event.target as HTMLSelectElement).value as GameMode;
      this.connection?.send({ type: "set_mode", payload: { mode: next } });
    }, { signal });
    this.root.querySelector("#setting-shake")?.addEventListener("change", (event) => {
      this.settings.screenshake = (event.target as HTMLInputElement).checked;
      saveSettings(this.settings);
    }, { signal });
    this.root.querySelector("#setting-flash")?.addEventListener("change", (event) => {
      this.settings.reducedFlash = (event.target as HTMLInputElement).checked;
      saveSettings(this.settings);
    }, { signal });
    this.root.querySelector("#setting-mute")?.addEventListener("change", (event) => {
      this.settings.musicMuted = (event.target as HTMLInputElement).checked;
      saveSettings(this.settings);
      this.game.setMusicVolume(this.settings.musicVolume, this.settings.musicMuted);
    }, { signal });
    this.root.querySelector("#setting-volume")?.addEventListener("input", (event) => {
      this.settings.musicVolume = Number((event.target as HTMLInputElement).value);
      saveSettings(this.settings);
      this.game.setMusicVolume(this.settings.musicVolume, this.settings.musicMuted);
    }, { signal });
  }
  private async refreshOpenRooms() {
    if (this.state.screen !== "home" || this.homeMode !== "join") {
      return;
    }

    this.state.roomsBusy = true;
    this.render();
    try {
      this.state.openRooms = await listOpenRooms();
      this.state.notice = this.state.openRooms.length === 0
        ? "No open rooms right now. Enter a code manually or create a room."
        : `Found ${this.state.openRooms.length} open room${this.state.openRooms.length === 1 ? "" : "s"}.`;
    } catch (error) {
      this.state.notice = error instanceof Error ? error.message : "Unable to load open rooms";
    } finally {
      this.state.roomsBusy = false;
      this.render();
    }
  }

  private async handleJoinFromListing(roomCode: string) {
    const playerNameInput = this.root.querySelector<HTMLInputElement>('input[name="playerName"]');
    const shipInput = this.root.querySelector<HTMLInputElement>('input[data-ship-input]:checked');
    const playerName = playerNameInput?.value ?? "";
    const shipId = shipInput?.value ?? this.selectedShip;

    if (!playerName.trim()) {
      this.state.notice = "Enter your pilot name before joining a room.";
      this.render();
      return;
    }

    const roomCodeInput = this.root.querySelector<HTMLInputElement>('input[name="roomCode"]');
    if (roomCodeInput) {
      roomCodeInput.value = roomCode;
    }

    await this.handleJoin(playerName, roomCode, shipId);
  }

  private async handleRegister(fullName: string, email: string, phone: string) {
    this.setBusy(true, "Registering...");
    try {
      const result = await registerPlayer({ fullName, email, phone: phone || undefined });
      this.registration = { playerId: result.playerId, fullName: result.fullName };
      saveRegistration(this.registration);
      this.state.screen = "home";
      this.state.notice = "Registration complete! Create a room or join with a code.";
    } catch (error) {
      this.state.notice = error instanceof Error ? error.message : "Registration failed";
    } finally {
      this.setBusy(false);
    }
  }

  private async handleCreate(playerName: string, shipIdRaw: string) {
    this.setBusy(true, "Generating room code...");
    try {
      const shipId = this.resolveShipId(shipIdRaw);
      const summary = await createRoom({ playerName, shipId });
      await this.connectToRoom(summary.playerId, summary.roomCode, playerName, shipId, summary.room);
      this.state.notice = `Room ${summary.roomCode} is live. Click start game when the squad is ready.`;
    } catch (error) {
      this.state.notice = error instanceof Error ? error.message : "Unable to create room";
    } finally {
      this.setBusy(false);
    }
  }

  private async handleJoin(playerName: string, roomCode: string, shipIdRaw: string) {
    this.setBusy(true, "Joining squad...");
    try {
      const normalizedRoomCode = this.normalizeRoomCode(roomCode);
      if (normalizedRoomCode.length !== ROOM_CODE_LENGTH) {
        throw new Error(`Room code must be ${ROOM_CODE_LENGTH} characters`);
      }
      const shipId = this.resolveShipId(shipIdRaw);
      const summary = await joinRoom(normalizedRoomCode, { playerName, shipId });
      await this.connectToRoom(summary.playerId, summary.roomCode, playerName, shipId, summary.room);
      this.state.notice = `Joined room ${summary.roomCode}. Waiting for the host to start the game.`;
    } catch (error) {
      this.state.notice = error instanceof Error ? error.message : "Unable to join room";
    } finally {
      this.setBusy(false);
    }
  }

  private async connectToRoom(playerId: string, roomCode: string, playerName: string, shipId: ShipId, room: RoomState) {
    this.connection?.disconnect();
    this.session = { playerId, roomCode, playerName, shipId };
    this.selectedShip = shipId;
    saveSession(this.session);
    this.state.room = room;
    this.state.result = null;
    this.state.snapshot = null;
    this.state.eventLog = [];
    this.state.screen = room.status === "in_match" ? "game" : "lobby";
    this.connection = new RoomConnection(roomCode, playerId);
    await this.connection.connect((message) => this.handleServerMessage(message), () => this.handleSocketClose());
  }

  private handleServerMessage(message: ServerMessage) {
    switch (message.type) {
      case "room_state":
        this.state.room = message.payload;
        if (this.session) {
          const me = message.payload.players.find((player) => player.playerId === this.session?.playerId);
          if (me) {
            this.selectedShip = me.shipId;
            this.session = { ...this.session, shipId: me.shipId, playerName: me.name };
            saveSession(this.session);
          }
        }
        if (message.payload.status === "waiting") {
          if (this.state.screen === "results") {
            this.state.notice = "Run complete. Return to lobby to start another game.";
            this.render();
          } else if (this.state.screen === "lobby") {
            this.refreshLobbyPanel();
          } else {
            this.state.screen = "lobby";
            this.render();
          }
        } else if (message.payload.status === "in_match" && this.state.screen !== "game") {
          this.state.screen = "game";
          this.render();
        }
        return;
      case "match_started":
        this.state.screen = "game";
        this.state.notice = `${message.payload.stageLabel} engaged.`;
        this.state.eventLog = [{ kind: "info", text: `Mode ${message.payload.mode} armed.` }];
        this.render();
        return;
      case "snapshot":
        this.state.snapshot = message.payload;
        this.game.setSnapshot(message.payload, this.session?.playerId ?? null);
        this.refreshGamePanel();
        return;
      case "game_event":
        this.state.eventLog = [{ kind: message.payload.kind, text: message.payload.text }, ...this.state.eventLog].slice(0, 8);
        this.refreshGamePanel();
        return;
      case "match_result":
        this.state.result = message.payload;
        this.state.leaderboardRank = message.payload.leaderboardRank;
        this.state.screen = "results";
        this.state.notice = message.payload.outcome === "victory" ? "Galaxy Shooter survived the run." : "The squad was overwhelmed.";
        if (this.session) {
          saveScore(this.session.playerName, message.payload);
        }
        this.game.clear();
        this.render();
        return;
      case "error":
        this.state.notice = message.payload.message;
        this.render();
        return;
      default:
        return;
    }
  }

  private handleSocketClose() {
    this.connection = null;
    if (this.state.screen === "game" && this.session) {
      this.autoReconnect();
      return;
    }
    if (this.state.room?.status === "in_match") {
      this.state.notice = "Connection lost. If the room still exists you can rejoin with the same code.";
    }
    this.render();
  }

  private autoReconnect(attempt = 0) {
    const maxAttempts = 5;
    if (attempt >= maxAttempts || !this.session) {
      this.state.notice = "Connection lost after multiple retries.";
      this.render();
      return;
    }
    const delayMs = Math.min(1000 * 2 ** attempt, 8000);
    this.state.notice = `Reconnecting (attempt ${attempt + 1}/${maxAttempts})...`;
    this.render();
    setTimeout(async () => {
      if (!this.session) {
        return;
      }
      try {
        this.connection = new RoomConnection(this.session.roomCode, this.session.playerId);
        await this.connection.connect(
          (message) => this.handleServerMessage(message),
          () => this.handleSocketClose()
        );
        this.state.notice = "";
        this.render();
      } catch {
        this.connection = null;
        this.autoReconnect(attempt + 1);
      }
    }, delayMs);
  }

  private async tryReconnect() {
    if (!this.session) {
      return;
    }
    this.selectedShip = this.session.shipId ?? DEFAULT_SHIP_ID;
    this.state.notice = `Trying to reconnect to ${this.session.roomCode}...`;
    try {
      this.connection = new RoomConnection(this.session.roomCode, this.session.playerId);
      await this.connection.connect((message) => this.handleServerMessage(message), () => {
        clearSession();
        this.session = null;
        this.state.notice = "Previous room expired. Create or join a new one.";
        this.render();
      });
    } catch {
      clearSession();
      this.connection = null;
      this.session = null;
      this.state.notice = "Previous room expired. Create or join a new one.";
      this.render();
    }
  }

  private leaveRoom() {
    this.connection?.send({ type: "leave_room" });
    this.connection?.disconnect();
    this.resetToHome();
  }

  private backToLobby() {
    this.clearCongratsTimer();
    if (!this.state.room) {
      this.resetToHome();
      return;
    }

    this.state.screen = "lobby";
    this.state.snapshot = null;
    this.state.result = null;
    this.state.eventLog = [];
    this.state.notice = "Room ready for another run.";
    this.game.clear();
    this.render();
  }

  private resetToHome() {
    this.clearCongratsTimer();
    this.connection?.disconnect();
    this.connection = null;
    this.state = {
      screen: "home",
      room: null,
      snapshot: null,
      result: null,
      notice: "Create a room or join with a code.",
      busy: false,
      eventLog: [],
      openRooms: [],
      roomsBusy: false,
      leaderboardRank: null,
      leaderboardMode: "campaign",
      leaderboardEntries: [],
      leaderboardLoading: false,
      leaderboardError: null,
      previousScreen: "home"
    };
    this.game.clear();
    clearSession();
    this.session = null;
    this.render();
  }

  private setBusy(busy: boolean, notice?: string) {
    this.state.busy = busy;
    if (notice) {
      this.state.notice = notice;
    }
    this.render();
  }

  private resolveShipId(value: string): ShipId {
    return SHIP_OPTIONS.some((ship) => ship.id === value) ? (value as ShipId) : DEFAULT_SHIP_ID;
  }

  private normalizeRoomCode(value: string) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
  }

  private getScreenTitle(): string {
    switch (this.state.screen) {
      case "home": return "Galaxy Shooter";
      case "lobby": return `Lobby ${this.state.room?.roomCode ?? ""} — Galaxy Shooter`;
      case "game": return `Playing ${this.state.room?.roomCode ?? ""} — Galaxy Shooter`;
      case "results": return `Results — Galaxy Shooter`;
      case "scores": return "High Scores — Galaxy Shooter";
      case "settings": return "Settings — Galaxy Shooter";
      default: return "Galaxy Shooter";
    }
  }

  private getControllerUrl(): string {
    const origin = window.location.origin;
    const url = new URL("/controller", origin);
    url.searchParams.set("room", this.state.room?.roomCode ?? "");
    url.searchParams.set("player", this.session?.playerId ?? "");
    return url.toString();
  }

  private renderQrCode(containerId: string) {
    const container = this.root.querySelector(`#${containerId}`);
    if (!container || !this.state.room || !this.session) return;
    const url = this.getControllerUrl();
    // QRCode.toString produces trusted SVG from a URL we construct — safe to insert as HTML
    QRCode.toString(url, { type: "svg", margin: 1, width: 160 }, (err, svg) => {
      if (err || !svg) return;
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, "image/svg+xml");
      const svgEl = doc.documentElement;
      container.replaceChildren(svgEl);
    });
  }

  private escape(value: string) {
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
  }
}




















