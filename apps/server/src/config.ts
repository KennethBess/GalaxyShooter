import { hostname } from "node:os";

export interface BackendConfig {
  redisUrl?: string;
  instanceId: string;
  roomStateTtlSeconds: number;
  roomOwnerTtlSeconds: number;
  webPubSubConnectionString?: string;
  webPubSubHub: string;
}

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const loadBackendConfig = (): BackendConfig => ({
  redisUrl: process.env.REDIS_URL?.trim() || undefined,
  instanceId: process.env.INSTANCE_ID?.trim() || `${hostname()}-${process.pid}`,
  roomStateTtlSeconds: parseNumber(process.env.ROOM_STATE_TTL_SECONDS, 3600),
  roomOwnerTtlSeconds: parseNumber(process.env.ROOM_OWNER_TTL_SECONDS, 3600),
  webPubSubConnectionString: process.env.WEB_PUBSUB_CONNECTION_STRING?.trim() || undefined,
  webPubSubHub: process.env.WEB_PUBSUB_HUB?.trim() || "galaxyshooter"
});

