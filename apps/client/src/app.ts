import { DEFAULT_SHIP_ID, ROOM_CODE_LENGTH, SHIP_OPTIONS, type GameMode, type OpenRoomSummary, type ResultSummary, type RoomState, type ServerMessage, type ShipId, type SnapshotState } from "@shared/index";
import { createRoom, joinRoom, listOpenRooms } from "./api";
import { RoomConnection } from "./network";
import { createGame } from "./phaser/game";
import { clearSession, loadScores, loadSession, loadSettings, saveScore, saveSession, saveSettings, type StoredSession } from "./storage";
import { heroBannerSvg, shipLabel, shipPreviewSvg } from "./templates";

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
  private eventAbort: AbortController | null = null;
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
                <div id="lobby-notice" class="notice-banner">${this.escape(this.state.notice)}</div>
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
                      <span class="lobby-chip">${shipLabel(player.shipId)}</span>
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

    this.root.querySelector("#show-scores")?.addEventListener("click", () => {
      this.state.screen = "scores";
      this.render();
    }, { signal });
    this.root.querySelector("#show-settings")?.addEventListener("click", () => {
      this.state.screen = "settings";
      this.render();
    }, { signal });
    this.root.querySelector("#back-home")?.addEventListener("click", () => this.resetToHome(), { signal });
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




















