import type { GameMode, ResultSummary, ShipId } from "@shared/index";

const HIGHSCORES_KEY = "space-shmup-highscores";
const SETTINGS_KEY = "space-shmup-settings";
const SESSION_KEY = "space-shmup-session";
const REGISTRATION_KEY = "space-shmup-registration";

export interface StoredScore {
  mode: GameMode;
  playerName: string;
  score: number;
  achievedAt: number;
}

export interface StoredSettings {
  screenshake: boolean;
  reducedFlash: boolean;
  musicVolume: number;
  musicMuted: boolean;
}

export interface StoredSession {
  roomCode: string;
  playerId: string;
  playerName: string;
  shipId: ShipId;
}

const parse = <T>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const loadScores = () => parse<StoredScore[]>(HIGHSCORES_KEY, []);

export const saveScore = (playerName: string, result: ResultSummary) => {
  const next = [
    { mode: result.mode, playerName, score: result.score, achievedAt: Date.now() },
    ...loadScores()
  ]
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
  localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(next));
};

export const loadSettings = (): StoredSettings => parse<StoredSettings>(SETTINGS_KEY, { screenshake: true, reducedFlash: false, musicVolume: 0.5, musicMuted: false });
export const saveSettings = (settings: StoredSettings) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
export interface StoredRegistration {
  playerId: string;
  fullName: string;
}

export const loadSession = () => parse<StoredSession | null>(SESSION_KEY, null);
export const saveSession = (session: StoredSession) => localStorage.setItem(SESSION_KEY, JSON.stringify(session));
export const clearSession = () => localStorage.removeItem(SESSION_KEY);
export const loadRegistration = () => parse<StoredRegistration | null>(REGISTRATION_KEY, null);
export const saveRegistration = (reg: StoredRegistration) => localStorage.setItem(REGISTRATION_KEY, JSON.stringify(reg));
export const clearRegistration = () => localStorage.removeItem(REGISTRATION_KEY);
