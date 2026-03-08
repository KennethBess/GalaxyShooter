import { ROOM_CODE_LENGTH, SHIP_IDS } from "@shared/index";
import { z } from "zod";

const playerNameSchema = z.string().trim().min(1).max(20);
const shipIdSchema = z.enum(SHIP_IDS).optional();

const createRoomRequestSchema = z.object({
  playerName: playerNameSchema,
  shipId: shipIdSchema,
});

const joinRoomRequestSchema = z.object({
  playerName: playerNameSchema,
  shipId: shipIdSchema,
});

const realtimeNegotiationRequestSchema = z.object({
  roomCode: z.string().trim().toUpperCase().length(ROOM_CODE_LENGTH),
  playerId: z.string().min(1),
});

export const parseCreateRoomRequest = (body: unknown) => createRoomRequestSchema.parse(body);
export const parseJoinRoomRequest = (body: unknown) => joinRoomRequestSchema.parse(body);
export const parseRealtimeNegotiationRequest = (body: unknown) => realtimeNegotiationRequestSchema.parse(body);
