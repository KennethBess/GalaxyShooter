import type {
  CreateRoomRequest,
  GameMode,
  JoinRoomRequest,
  LeaderboardEntry,
  OpenRoomSummary,
  RealtimeNegotiationRequest,
  RealtimeNegotiationResponse,
  RegisterRequest,
  RegisterResponse,
  RoomSummary
} from "@shared/index";

const fallbackApiBase = typeof window !== "undefined"
  ? window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : window.location.origin
  : "http://localhost:3001";

const API_BASE = import.meta.env.VITE_API_BASE ?? fallbackApiBase;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ message: "Request failed" }))) as { message?: string };
    throw new Error(payload.message ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export const apiBase = API_BASE;

export const createRoom = (payload: CreateRoomRequest) =>
  request<RoomSummary>("/rooms", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const listOpenRooms = () =>
  request<OpenRoomSummary[]>("/rooms/open");

export const joinRoom = (roomCode: string, payload: JoinRoomRequest) =>
  request<RoomSummary>(`/rooms/${roomCode}/join`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const negotiateRealtime = (payload: RealtimeNegotiationRequest) =>
  request<RealtimeNegotiationResponse>("/realtime/negotiate", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const fetchLeaderboard = (mode: GameMode) =>
  request<LeaderboardEntry[]>(`/api/leaderboard?mode=${mode}`);

<<<<<<< HEAD
export async function deleteLeaderboardEntry(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/leaderboard/${id}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ message: "Delete failed" }))) as { message?: string };
    throw new Error(payload.message ?? "Delete failed");
  }
}
=======
export const resetLeaderboard = (mode: string) =>
  request<{ cleared: string }>(`/api/leaderboard?mode=${mode}`, { method: "DELETE" });

export const registerPlayer = (payload: RegisterRequest) =>
  request<RegisterResponse>("/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
>>>>>>> 26346b719fa32fa0259e8014001c5f359b3a3f6b
