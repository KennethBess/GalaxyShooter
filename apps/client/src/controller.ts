import type { ClientMessage, InputState, ServerMessage } from "@shared/index";
import { apiBase } from "./api";

const WS_BASE = (import.meta.env.VITE_WS_BASE as string | undefined) ?? apiBase.replace(/^http/, "ws");
const WEB_PUBSUB_PROTOCOL = "json.webpubsub.azure.v1";

interface NegotiateResponse {
  mode: "direct" | "webpubsub";
  url: string;
  hub?: string;
  protocol?: string;
}

const params = new URLSearchParams(window.location.search);
const roomCode = params.get("room") ?? "";
const playerId = params.get("player") ?? "";

const root = document.getElementById("controller")!;

const inputState: InputState = { up: false, down: false, left: false, right: false, shoot: false };
let prevSentKey = "";
let socket: WebSocket | null = null;
let mode: "direct" | "webpubsub" = "direct";
let ackId = 1;
let paired = false;

function setStatus(text: string, state: "connecting" | "connected" | "error") {
  const statusEl = root.querySelector<HTMLElement>("#ctrl-status");
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.className = `ctrl-status ctrl-status-${state}`;
  }
}

function sendMessage(message: ClientMessage) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  if (mode === "webpubsub") {
    socket.send(JSON.stringify({
      type: "event",
      event: "client-message",
      dataType: "json",
      data: message,
      ackId: ackId++
    }));
  } else {
    socket.send(JSON.stringify(message));
  }
}

/** Send immediately, but skip if state hasn't changed since last send. */
function sendInput() {
  if (!paired) return;
  const key = `${+inputState.up}${+inputState.down}${+inputState.left}${+inputState.right}${+inputState.shoot}`;
  if (key === prevSentKey) return;
  prevSentKey = key;
  sendMessage({ type: "input", payload: { ...inputState } });
}

function sendBomb() {
  if (!paired) return;
  sendMessage({ type: "use_bomb" });
}

// Touch d-pad handling
function setupDpad() {
  const dpad = root.querySelector<HTMLElement>("#ctrl-dpad");
  if (!dpad) return;

  const updateFromTouch = (e: TouchEvent) => {
    e.preventDefault();
    const rect = dpad.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    inputState.up = false;
    inputState.down = false;
    inputState.left = false;
    inputState.right = false;

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i]!;
      if (touch.clientX < rect.left || touch.clientX > rect.right ||
          touch.clientY < rect.top || touch.clientY > rect.bottom) continue;

      const dx = touch.clientX - centerX;
      const dy = touch.clientY - centerY;
      const deadzone = rect.width * 0.15;

      if (dy < -deadzone) inputState.up = true;
      if (dy > deadzone) inputState.down = true;
      if (dx < -deadzone) inputState.left = true;
      if (dx > deadzone) inputState.right = true;
    }

    updateDpadVisuals();
    sendInput();
  };

  const clearDpad = (e: TouchEvent) => {
    e.preventDefault();
    inputState.up = false;
    inputState.down = false;
    inputState.left = false;
    inputState.right = false;
    updateDpadVisuals();
    sendInput();
  };

  dpad.addEventListener("touchstart", updateFromTouch, { passive: false });
  dpad.addEventListener("touchmove", updateFromTouch, { passive: false });
  dpad.addEventListener("touchend", clearDpad, { passive: false });
  dpad.addEventListener("touchcancel", clearDpad, { passive: false });
}

function updateDpadVisuals() {
  root.querySelector("#dpad-up")?.classList.toggle("active", inputState.up);
  root.querySelector("#dpad-down")?.classList.toggle("active", inputState.down);
  root.querySelector("#dpad-left")?.classList.toggle("active", inputState.left);
  root.querySelector("#dpad-right")?.classList.toggle("active", inputState.right);
}

function setupButtons() {
  const shootBtn = root.querySelector<HTMLElement>("#ctrl-shoot");
  const bombBtn = root.querySelector<HTMLElement>("#ctrl-bomb");

  if (shootBtn) {
    const shootStart = (e: TouchEvent) => {
      e.preventDefault();
      inputState.shoot = true;
      shootBtn.classList.add("active");
      sendInput();
    };
    const shootEnd = (e: TouchEvent) => {
      e.preventDefault();
      inputState.shoot = false;
      shootBtn.classList.remove("active");
      sendInput();
    };
    shootBtn.addEventListener("touchstart", shootStart, { passive: false });
    shootBtn.addEventListener("touchend", shootEnd, { passive: false });
    shootBtn.addEventListener("touchcancel", shootEnd, { passive: false });
  }

  if (bombBtn) {
    const bombTap = (e: TouchEvent) => {
      e.preventDefault();
      bombBtn.classList.add("active");
      sendBomb();
      setTimeout(() => bombBtn.classList.remove("active"), 150);
    };
    bombBtn.addEventListener("touchstart", bombTap, { passive: false });
  }
}

function buildUI() {
  // Build style element
  const style = document.createElement("style");
  style.textContent = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; background: #0a0e17; color: #fff; font-family: system-ui, sans-serif; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; overscroll-behavior: none; }
    #controller { height: 100%; display: flex; flex-direction: column; }
    .ctrl-status { text-align: center; padding: 6px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
    .ctrl-status-connecting { background: #2a2a00; color: #ffd700; }
    .ctrl-status-connected { background: #002a00; color: #00ff66; }
    .ctrl-status-error { background: #2a0000; color: #ff4444; }
    .ctrl-controls { flex: 1; display: flex; align-items: center; justify-content: center; padding: 16px; gap: 12vw; }
    .ctrl-dpad { position: relative; width: 200px; height: 200px; flex-shrink: 0; }
    .dpad-btn { position: absolute; background: rgba(255,255,255,0.1); border-radius: 8px; transition: background 0.05s; }
    .dpad-btn.active { background: rgba(100,180,255,0.4); }
    #dpad-up { top: 0; left: 33.3%; width: 33.3%; height: 40%; border-radius: 8px 8px 0 0; }
    #dpad-down { bottom: 0; left: 33.3%; width: 33.3%; height: 40%; border-radius: 0 0 8px 8px; }
    #dpad-left { left: 0; top: 33.3%; width: 40%; height: 33.3%; border-radius: 8px 0 0 8px; }
    #dpad-right { right: 0; top: 33.3%; width: 40%; height: 33.3%; border-radius: 0 8px 8px 0; }
    .dpad-center { position: absolute; top: 33.3%; left: 33.3%; width: 33.3%; height: 33.3%; background: rgba(255,255,255,0.05); border-radius: 4px; }
    .dpad-arrow { position: absolute; color: rgba(255,255,255,0.5); font-size: 1.5rem; pointer-events: none; }
    #dpad-up .dpad-arrow { top: 20%; left: 50%; transform: translateX(-50%); }
    #dpad-down .dpad-arrow { bottom: 20%; left: 50%; transform: translateX(-50%); }
    #dpad-left .dpad-arrow { left: 20%; top: 50%; transform: translateY(-50%); }
    #dpad-right .dpad-arrow { right: 20%; top: 50%; transform: translateY(-50%); }
    .ctrl-buttons { display: flex; flex-direction: column; gap: 16px; align-items: center; flex-shrink: 0; }
    .ctrl-btn { border: none; border-radius: 50%; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.05s; }
    #ctrl-shoot { width: 120px; height: 120px; background: rgba(255,80,80,0.3); color: #ff6666; font-size: 1rem; border: 2px solid rgba(255,80,80,0.5); }
    #ctrl-shoot.active { background: rgba(255,80,80,0.6); }
    #ctrl-bomb { width: 72px; height: 72px; background: rgba(255,200,50,0.2); color: #ffcc44; font-size: 0.75rem; border: 2px solid rgba(255,200,50,0.4); }
    #ctrl-bomb.active { background: rgba(255,200,50,0.5); }
    .ctrl-rotate-hint { display: none; position: fixed; inset: 0; background: #0a0e17; z-index: 100; align-items: center; justify-content: center; flex-direction: column; gap: 1rem; font-size: 1.2rem; }
    @media (orientation: portrait) { .ctrl-rotate-hint { display: flex; } .ctrl-controls { display: none; } }
  `;
  document.head.appendChild(style);

  // Build DOM with safe methods
  const rotateHint = document.createElement("div");
  rotateHint.className = "ctrl-rotate-hint";
  rotateHint.setAttribute("aria-label", "Rotate device");
  const rotateIcon = document.createElement("span");
  rotateIcon.style.fontSize = "3rem";
  rotateIcon.textContent = "\u{1F4F1}\u2194\uFE0F";
  rotateHint.appendChild(rotateIcon);
  const rotateText = document.createElement("span");
  rotateText.textContent = "Rotate to landscape";
  rotateHint.appendChild(rotateText);

  const statusBar = document.createElement("div");
  statusBar.id = "ctrl-status";
  statusBar.className = "ctrl-status ctrl-status-connecting";
  statusBar.textContent = "Connecting...";

  const controls = document.createElement("div");
  controls.className = "ctrl-controls";

  // D-pad
  const dpad = document.createElement("div");
  dpad.id = "ctrl-dpad";
  dpad.className = "ctrl-dpad";
  for (const dir of ["up", "down", "left", "right"] as const) {
    const btn = document.createElement("div");
    btn.id = `dpad-${dir}`;
    btn.className = "dpad-btn";
    const arrow = document.createElement("span");
    arrow.className = "dpad-arrow";
    arrow.textContent = { up: "\u25B2", down: "\u25BC", left: "\u25C0", right: "\u25B6" }[dir];
    btn.appendChild(arrow);
    dpad.appendChild(btn);
  }
  const dpadCenter = document.createElement("div");
  dpadCenter.className = "dpad-center";
  dpad.appendChild(dpadCenter);

  // Buttons
  const buttons = document.createElement("div");
  buttons.className = "ctrl-buttons";
  const shootBtn = document.createElement("button");
  shootBtn.id = "ctrl-shoot";
  shootBtn.className = "ctrl-btn";
  shootBtn.type = "button";
  shootBtn.textContent = "FIRE";
  const bombBtn = document.createElement("button");
  bombBtn.id = "ctrl-bomb";
  bombBtn.className = "ctrl-btn";
  bombBtn.type = "button";
  bombBtn.textContent = "BOMB";
  buttons.appendChild(shootBtn);
  buttons.appendChild(bombBtn);

  controls.appendChild(dpad);
  controls.appendChild(buttons);

  root.appendChild(rotateHint);
  root.appendChild(statusBar);
  root.appendChild(controls);

  setupDpad();
  setupButtons();
}

function handleMessage(data: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return;
  }

  const msg = unwrapMessage(parsed);
  if (!msg) return;

  const serverMsg = msg as ServerMessage;
  if (serverMsg.type === "controller_paired") {
    paired = true;
    setStatus(`Connected \u2014 ${serverMsg.payload.playerName}`, "connected");
  } else if (serverMsg.type === "error") {
    setStatus(`Error: ${serverMsg.payload.message}`, "error");
  }
}

function unwrapMessage(parsed: unknown): unknown {
  if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.type === "message" && "data" in obj) return obj.data;
  if (obj.type === "ack" || obj.type === "system") return null;
  return parsed;
}

async function connect() {
  if (!roomCode || !playerId) {
    setStatus("Missing room or player info", "error");
    return;
  }

  try {
    const res = await fetch(`${apiBase}/realtime/negotiate/controller`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCode, playerId })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Connection failed" })) as { message?: string };
      setStatus(err.message ?? "Connection failed", "error");
      return;
    }

    const negotiation = await res.json() as NegotiateResponse;
    mode = negotiation.mode;

    const protocol = negotiation.mode === "webpubsub" ? WEB_PUBSUB_PROTOCOL : undefined;
    socket = protocol ? new WebSocket(negotiation.url, protocol) : new WebSocket(negotiation.url);

    socket.addEventListener("open", () => {
      setStatus("Pairing...", "connecting");
      if (mode === "webpubsub") {
        sendMessage({ type: "controller_connect", payload: { roomCode, playerId } });
      }
    });

    socket.addEventListener("message", (event) => {
      if (event.data instanceof Blob) {
        void event.data.text().then((t) => handleMessage(t));
      } else {
        handleMessage(typeof event.data === "string" ? event.data : String(event.data));
      }
    });

    socket.addEventListener("close", () => {
      paired = false;
      setStatus("Disconnected", "error");
    });

    socket.addEventListener("error", () => {
      setStatus("Connection error", "error");
    });
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Connection failed", "error");
  }
}

// Prevent pinch-to-zoom and double-tap zoom
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("gestureend", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());

buildUI();
void connect();
