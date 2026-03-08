import { DEFAULT_SHIP_ID, ROOM_CODE_LENGTH, SHIP_OPTIONS, type GameMode, type OpenRoomSummary, type ResultSummary, type RoomState, type ServerMessage, type ShipId, type SnapshotState } from "@shared/index";
import { createRoom, joinRoom, listOpenRooms } from "./api";
import { RoomConnection } from "./network";
import { createGame } from "./phaser/game";
import { clearSession, loadScores, loadSession, loadSettings, saveScore, saveSession, saveSettings, type StoredSession } from "./storage";

interface AppState {
  screen: "home" | "lobby" | "game" | "results" | "scores" | "settings";
  room: RoomState | null;
  snapshot: SnapshotState | null;
  result: ResultSummary | null;
  notice: string;
  busy: boolean;
  eventLog: string[];
  openRooms: OpenRoomSummary[];
  roomsBusy: boolean;
}

const shipMap = new Map(SHIP_OPTIONS.map((ship) => [ship.id, ship]));
const shipLabel = (shipId: ShipId) => shipMap.get(shipId)?.label ?? shipId;

const shipPreviewSvg = (shipId: ShipId) => {
  const ship = shipMap.get(shipId);
  if (!ship) {
    return "";
  }

  return `
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <path d="M48 10 L18 54 L35 72 L48 62 L61 72 L78 54 Z" fill="${ship.dark}" />
      <path d="M48 14 L24 54 L39 67 L48 58 L57 67 L72 54 Z" fill="${ship.primary}" />
      <rect x="40" y="18" width="16" height="42" rx="6" fill="${ship.primary}" />
      <rect x="44" y="21" width="8" height="24" rx="4" fill="${ship.trim}" />
      <rect x="21" y="48" width="10" height="18" rx="4" fill="${ship.primary}" />
      <rect x="65" y="48" width="10" height="18" rx="4" fill="${ship.primary}" />
      <rect x="33" y="39" width="8" height="18" fill="${ship.trim}" />
      <rect x="55" y="39" width="8" height="18" fill="${ship.trim}" />
      <circle cx="26" cy="72" r="5" fill="${ship.glow}" />
      <circle cx="70" cy="72" r="5" fill="${ship.glow}" />
      <path d="M26 72 L21 88 L31 88 Z" fill="#ffd9ae" opacity="0.82" />
      <path d="M70 72 L65 88 L75 88 Z" fill="#ffd9ae" opacity="0.82" />
    </svg>
  `;
};

const heroBannerSvg = () => `
  <svg viewBox="0 0 520 170" aria-hidden="true" role="presentation">
    <defs>
      <linearGradient id="hero-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0d1e35" />
        <stop offset="100%" stop-color="#09111f" />
      </linearGradient>
      <radialGradient id="hero-core" cx="50%" cy="38%" r="62%">
        <stop offset="0%" stop-color="#57b8ff" stop-opacity="0.7" />
        <stop offset="55%" stop-color="#17355d" stop-opacity="0.36" />
        <stop offset="100%" stop-color="#17355d" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="beam-blue" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#8ce8ff" stop-opacity="0" />
        <stop offset="100%" stop-color="#8ce8ff" stop-opacity="0.88" />
      </linearGradient>
      <linearGradient id="beam-red" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#ff8aa6" stop-opacity="0" />
        <stop offset="100%" stop-color="#ff8aa6" stop-opacity="0.9" />
      </linearGradient>
      <linearGradient id="beam-green" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#7df5c0" stop-opacity="0" />
        <stop offset="100%" stop-color="#7df5c0" stop-opacity="0.88" />
      </linearGradient>
    </defs>
    <rect width="520" height="170" rx="28" fill="url(#hero-bg)" />
    <rect x="1" y="1" width="518" height="168" rx="27" fill="none" stroke="#5eaef0" stroke-opacity="0.2" />
    <ellipse cx="258" cy="58" rx="150" ry="70" fill="url(#hero-core)" />
    <circle cx="433" cy="44" r="23" fill="#173e66" opacity="0.66" />
    <circle cx="433" cy="44" r="11" fill="#7dd8ff" opacity="0.72" />
    <g fill="#d7efff" opacity="0.75">
      <circle cx="49" cy="34" r="1.8" />
      <circle cx="101" cy="54" r="1.4" />
      <circle cx="154" cy="25" r="1.5" />
      <circle cx="317" cy="26" r="1.3" />
      <circle cx="387" cy="66" r="1.6" />
      <circle cx="470" cy="28" r="1.7" />
      <circle cx="455" cy="95" r="1.4" />
      <circle cx="74" cy="102" r="1.4" />
    </g>
    <g opacity="0.92">
      <ellipse cx="260" cy="42" rx="54" ry="18" fill="#163455" />
      <path d="M230 58 Q260 20 290 58" fill="#19375f" stroke="#6dd3ff" stroke-opacity="0.45" />
      <circle cx="260" cy="49" r="12" fill="#ffdc6b" />
      <circle cx="260" cy="49" r="5" fill="#ff7b53" />
      <path d="M237 63 L221 86 L237 83 Z" fill="#57d9ff" opacity="0.85" />
      <path d="M283 63 L299 86 L283 83 Z" fill="#57d9ff" opacity="0.85" />
    </g>
    <g transform="translate(85 72) scale(1.1)">
      <path d="M0 18 L14 0 L28 18 L21 32 L7 32 Z" fill="#ff5b59" />
      <rect x="11" y="8" width="6" height="20" fill="#f0f6ff" />
      <circle cx="7" cy="14" r="4" fill="#49c9ff" />
      <circle cx="21" cy="14" r="4" fill="#49c9ff" />
    </g>
    <g transform="translate(405 68) scale(1.1)">
      <path d="M0 18 L14 0 L28 18 L21 32 L7 32 Z" fill="#7c57ff" />
      <rect x="11" y="8" width="6" height="20" fill="#f0f6ff" />
      <circle cx="7" cy="14" r="4" fill="#7affcb" />
      <circle cx="21" cy="14" r="4" fill="#7affcb" />
    </g>
    <rect x="183" y="84" width="4" height="40" rx="2" fill="url(#beam-blue)" />
    <rect x="258" y="76" width="4" height="52" rx="2" fill="url(#beam-red)" />
    <rect x="333" y="84" width="4" height="40" rx="2" fill="url(#beam-green)" />
    <g transform="translate(144 94)">
      <path d="M40 0 L12 40 L26 57 L40 48 L54 57 L68 40 Z" fill="#1d3d65" />
      <path d="M40 4 L18 40 L30 52 L40 44 L50 52 L62 40 Z" fill="#62b8ff" />
      <rect x="33" y="8" width="14" height="34" rx="6" fill="#62b8ff" />
      <rect x="37" y="11" width="6" height="18" rx="3" fill="#dcefff" />
      <circle cx="18" cy="56" r="4" fill="#ffae4d" />
      <circle cx="62" cy="56" r="4" fill="#ffae4d" />
    </g>
    <g transform="translate(219 82) scale(1.08)">
      <path d="M40 0 L12 40 L26 57 L40 48 L54 57 L68 40 Z" fill="#612039" />
      <path d="M40 4 L18 40 L30 52 L40 44 L50 52 L62 40 Z" fill="#ff6885" />
      <rect x="33" y="8" width="14" height="34" rx="6" fill="#ff6885" />
      <rect x="37" y="11" width="6" height="18" rx="3" fill="#ffe1e8" />
      <circle cx="18" cy="56" r="4" fill="#ffad52" />
      <circle cx="62" cy="56" r="4" fill="#ffad52" />
    </g>
    <g transform="translate(294 94)">
      <path d="M40 0 L12 40 L26 57 L40 48 L54 57 L68 40 Z" fill="#175241" />
      <path d="M40 4 L18 40 L30 52 L40 44 L50 52 L62 40 Z" fill="#56d6a0" />
      <rect x="33" y="8" width="14" height="34" rx="6" fill="#56d6a0" />
      <rect x="37" y="11" width="6" height="18" rx="3" fill="#e0fff2" />
      <circle cx="18" cy="56" r="4" fill="#ffbf61" />
      <circle cx="62" cy="56" r="4" fill="#ffbf61" />
    </g>
  </svg>
`;

export class App {
  private readonly gameHost = (() => {
    const host = document.createElement("div");
    host.className = "game-canvas";
    return host;
  })();
  private readonly game = createGame(this.gameHost, (input) => this.connection?.send({ type: "input", payload: input }), () => this.connection?.send({ type: "use_bomb" }));
  private readonly settings = loadSettings();
  private connection: RoomConnection | null = null;
  private session: StoredSession | null = loadSession();
  private selectedShip: ShipId = this.session?.shipId ?? DEFAULT_SHIP_ID;
  private homeMode: "create" | "join" = "create";
  private state: AppState = {
    screen: "home",
    room: null,
    snapshot: null,
    result: null,
    notice: "Create a room or join with a code.",
    busy: false,
    eventLog: [],
    openRooms: [],
    roomsBusy: false
  };

  constructor(private readonly root: HTMLElement) {
    void this.tryReconnect();
    this.render();
  }

  private render() {
    const room = this.state.room;
    const players = room?.players ?? [];
    const playerName = this.session?.playerName ?? "";
    const myPlayer = players.find((player) => player.playerId === this.session?.playerId);
    const scores = loadScores();

    this.root.className = `app-root screen-${this.state.screen}`;
    this.root.innerHTML = this.state.screen === "game"
      ? this.getGameMarkup(room)
      : this.getFrontMarkup(room, players, myPlayer, playerName, scores);

    this.mountGameHost();
    this.bindEvents();
    this.syncShipPickerSelection();
    if (this.state.screen === "game") {
      this.refreshGamePanel();
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
      case "home":
        return `
          <main class="front-page landing-page">
            <div class="landing-grid">
              <section class="hero landing-hero">
                <div class="hero-art" aria-hidden="true">${heroBannerSvg()}</div>
                <div class="landing-copy">
                  <p class="eyebrow">Browser Co-op Shmup</p>
                  <h1>Galaxy Shooter</h1>
                  <p class="lede">Create a squad room, share the code, and push through campaign bosses or survival together.</p>
                </div>
                <div class="landing-support">
                  <div class="notice-banner">${this.escape(this.state.notice)}</div>
                  <div class="hero-meta">
                    <span>Up to 4 players</span>
                    <span>Room code join</span>
                    <span>Campaign + Survival</span>
                  </div>
                </div>
              </section>
              <section class="front-card landing-panel">
                <div class="mode-switch" role="tablist" aria-label="Room action">
                  <button id="switch-create" class="mode-pill ${this.homeMode === "create" ? "active" : ""}" type="button">Create Room</button>
                  <button id="switch-join" class="mode-pill ${this.homeMode === "join" ? "active" : ""}" type="button">Join Room</button>
                </div>
                <form id="${this.homeMode}-form" class="stack compact-stack">
                  <input name="playerName" maxlength="16" placeholder="Pilot name" value="${this.escape(playerName)}" required />
                  ${this.homeMode === "join" ? '<input name="roomCode" maxlength="5" placeholder="Game code" style="text-transform:uppercase" required />' : ""}
                  ${this.renderShipPicker(`${this.homeMode}-ship-id`)}
                  ${this.homeMode === "join" ? this.renderOpenRooms() : ""}
                  <button type="submit" class="primary-button" ${this.state.busy ? "disabled" : ""}>${this.homeMode === "create" ? "Generate room code" : "Join squad"}</button>
                </form>
                <div class="utility-actions">
                  <button id="show-scores" class="secondary-button">High Scores</button>
                  <button id="show-settings" class="secondary-button">Settings</button>
                </div>
              </section>
            </div>
          </main>
        `;
      case "lobby":
        return `
          <main class="front-page lobby-page">
            <div class="lobby-grid">
              <header class="hero lobby-hero">
                <p class="eyebrow">Squad Lobby</p>
                <h1>${room?.roomCode ?? "-----"}</h1>
                <p class="lede">Share this code. After everyone joins, click start game to move into the play screen.</p>
                <div class="lobby-meta">
                  <div class="lobby-stat">
                    <span class="lobby-stat-label">Pilots</span>
                    <strong>${players.length}/4</strong>
                  </div>
                  <div class="lobby-stat">
                    <span class="lobby-stat-label">Mode</span>
                    <strong>${room?.mode === "survival" ? "Survival" : "Campaign"}</strong>
                  </div>
                  <div class="lobby-stat">
                    <span class="lobby-stat-label">Host</span>
                    <strong>${this.escape(players.find((player) => player.isHost)?.name ?? "-")}</strong>
                  </div>
                </div>
                <div class="notice-banner">${this.escape(this.state.notice)}</div>
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
                  <span>${players.filter((player) => player.connected).length} online</span>
                </div>
                <ul class="roster lobby-roster">
                  ${players.map((player) => `<li>
                    <span class="lobby-roster-name">
                      <span>${this.escape(player.name)}</span>
                      <span class="lobby-chip">${shipLabel(player.shipId)}</span>
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
              </section>
            </div>
          </main>
        `;
      case "results":
        return `
          <main class="front-page">
            <div class="front-shell compact-shell">
              <header class="hero compact-hero">
                <p class="eyebrow">Mission ${this.state.result?.outcome === "victory" ? "Cleared" : "Failed"}</p>
                <h1>${this.state.result?.score ?? 0}</h1>
                <p class="lede">${this.escape(this.state.notice)}</p>
              </header>
              <section class="front-card">
                <p>Mode: ${this.state.result?.mode ?? "-"}</p>
                <p>Stage reached: ${this.state.result?.stageReached ?? 0}</p>
                <p>Duration: ${Math.round((this.state.result?.durationMs ?? 0) / 1000)}s</p>
                <ul class="roster compact-roster">
                  ${(this.state.result?.players ?? []).map((player) => `<li><span>${this.escape(player.name)} (${shipLabel(player.shipId)})</span><span>${player.score}</span></li>`).join("")}
                </ul>
                <div class="lobby-actions">
                  ${room?.status === "waiting" ? '<button id="back-lobby" class="primary-button">Back to lobby</button>' : '<button id="back-home" class="primary-button">Front page</button>'}
                  <button id="show-scores" class="secondary-button">High Scores</button>
                </div>
              </section>
            </div>
          </main>
        `;
      case "scores":
        return `
          <main class="front-page">
            <div class="front-shell compact-shell">
              <header class="hero compact-hero">
                <p class="eyebrow">Local board</p>
                <h1>High Scores</h1>
              </header>
              <section class="front-card">
                <ul class="roster compact-roster">
                  ${scores.map((entry) => `<li><span>${this.escape(entry.playerName)} / ${entry.mode}</span><span>${entry.score}</span></li>`).join("") || "<li><span>No scores yet</span><span>-</span></li>"}
                </ul>
                <div class="lobby-actions">
                  <button id="back-home" class="primary-button">Front page</button>
                </div>
              </section>
            </div>
          </main>
        `;
      case "settings":
        return `
          <main class="front-page">
            <div class="front-shell compact-shell">
              <header class="hero compact-hero">
                <p class="eyebrow">Local preferences</p>
                <h1>Settings</h1>
              </header>
              <section class="front-card stack">
                <label class="toggle"><input id="setting-shake" type="checkbox" ${this.settings.screenshake ? "checked" : ""} /> Screen shake</label>
                <label class="toggle"><input id="setting-flash" type="checkbox" ${this.settings.reducedFlash ? "checked" : ""} /> Reduced flash</label>
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

  private getGameMarkup(room: RoomState | null) {
    return `
      <main class="game-page">
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
            <div class="game-root"></div>
          </div>
          <aside class="game-sidebar">
            <section class="game-card">
              <h2>Squad</h2>
              <ul id="game-roster" class="roster compact-roster"></ul>
            </section>
            <section class="game-card">
              <h2>Combat Feed</h2>
              <ul id="game-feed" class="feed"></ul>
            </section>
          </aside>
        </section>
      </main>
    `;
  }

  private renderShipPicker(groupName: string) {
    return `
      <div class="ship-grid">
        ${SHIP_OPTIONS.map((ship) => `
          <label class="ship-option ${ship.id === this.selectedShip ? "selected" : ""}">
            <input type="radio" data-ship-input name="${groupName}" value="${ship.id}" ${ship.id === this.selectedShip ? "checked" : ""} />
            <span class="ship-option-preview">${shipPreviewSvg(ship.id)}</span>
            <span class="ship-option-name">${ship.label}</span>
          </label>
        `).join("")}
      </div>
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
        .map((player) => `<li><span>${this.escape(player.name)} (${shipLabel(player.shipId)})</span><span>${player.alive ? `score ${player.score}` : "down"}</span></li>`)
        .join("");
      if (roster.innerHTML !== nextRosterMarkup) {
        roster.innerHTML = nextRosterMarkup;
      }
    }
    if (feed) {
      const nextFeedMarkup = this.state.eventLog.length > 0
        ? this.state.eventLog.map((entry) => `<li>${this.escape(entry)}</li>`).join("")
        : "<li>Hold formation.</li>";
      if (feed.innerHTML !== nextFeedMarkup) {
        feed.innerHTML = nextFeedMarkup;
      }
    }
  }
  private bindEvents() {
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
    });

    this.root.querySelector("#switch-create")?.addEventListener("click", () => {
      this.homeMode = "create";
      this.render();
    });
    this.root.querySelector("#switch-join")?.addEventListener("click", () => {
      this.homeMode = "join";
      this.render();
      void this.refreshOpenRooms();
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-ship-input]").forEach((input) => {
      input.addEventListener("change", () => {
        this.selectedShip = input.value as ShipId;
        this.syncShipPickerSelection();
      });
    });

    this.root.querySelector<HTMLInputElement>("input[name=\"roomCode\"]")?.addEventListener("input", (event) => {
      const input = event.target as HTMLInputElement;
      input.value = this.normalizeRoomCode(input.value);
    });

    this.root.querySelector("#refresh-open-rooms")?.addEventListener("click", () => {
      void this.refreshOpenRooms();
    });
    this.root.querySelectorAll<HTMLElement>("[data-join-room-code]").forEach((button) => {
      button.addEventListener("click", () => {
        void this.handleJoinFromListing(button.dataset.joinRoomCode ?? "");
      });
    });

    this.root.querySelector("#show-scores")?.addEventListener("click", () => {
      this.state.screen = "scores";
      this.render();
    });
    this.root.querySelector("#show-settings")?.addEventListener("click", () => {
      this.state.screen = "settings";
      this.render();
    });
    this.root.querySelector("#back-home")?.addEventListener("click", () => this.resetToHome());
    this.root.querySelector("#back-lobby")?.addEventListener("click", () => this.backToLobby());
    this.root.querySelector("#leave-room")?.addEventListener("click", () => this.leaveRoom());
    this.root.querySelector("#toggle-ready")?.addEventListener("click", () => {
      const current = this.state.room?.players.find((player) => player.playerId === this.session?.playerId);
      this.connection?.send({ type: "ready", payload: { ready: !(current?.ready ?? false) } });
    });
    this.root.querySelector("#start-match")?.addEventListener("click", () => this.connection?.send({ type: "start_match" }));
    this.root.querySelector("#mode-select")?.addEventListener("change", (event) => {
      const next = (event.target as HTMLSelectElement).value as GameMode;
      this.connection?.send({ type: "set_mode", payload: { mode: next } });
    });
    this.root.querySelector("#setting-shake")?.addEventListener("change", (event) => {
      this.settings.screenshake = (event.target as HTMLInputElement).checked;
      saveSettings(this.settings);
    });
    this.root.querySelector("#setting-flash")?.addEventListener("change", (event) => {
      this.settings.reducedFlash = (event.target as HTMLInputElement).checked;
      saveSettings(this.settings);
    });
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
        this.state.eventLog = [`Mode ${message.payload.mode} armed.`];
        this.render();
        return;
      case "snapshot":
        this.state.snapshot = message.payload;
        this.game.setSnapshot(message.payload, this.session?.playerId ?? null);
        this.refreshGamePanel();
        return;
      case "game_event":
        this.state.eventLog = [message.payload.text, ...this.state.eventLog].slice(0, 8);
        this.refreshGamePanel();
        return;
      case "match_result":
        this.state.result = message.payload;
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
    if (this.state.room?.status === "in_match") {
      this.state.notice = "Connection lost. If the room still exists you can rejoin with the same code.";
    }
    this.connection = null;
    this.render();
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
      roomsBusy: false
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

  private escape(value: string) {
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
  }
}




















