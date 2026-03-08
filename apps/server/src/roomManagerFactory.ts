import { WebPubSubServiceClient } from "@azure/web-pubsub";
import { createClient } from "redis";
import { loadBackendConfig } from "./config.js";
import { type ConnectionGateway, WebSocketConnectionGateway } from "./connectionGateway.js";
import { InMemoryRoomDirectory, RedisRoomDirectory } from "./roomDirectory.js";
import { RoomManager } from "./roomManager.js";
import { InMemoryRoomMessageBus, RedisRoomMessageBus } from "./roomMessageBus.js";
import { InMemoryRoomRepository, RedisRoomRepository } from "./roomRepository.js";
import { RoomService } from "./roomService.js";
import { InMemoryRoomRuntimeRegistry } from "./runtimeRegistry.js";
import { WebPubSubConnectionGateway } from "./webPubSubConnectionGateway.js";

export type RealtimeModeConfig =
  | { mode: "direct" }
  | {
      mode: "webpubsub";
      hub: string;
      serviceClient: WebPubSubServiceClient;
      allowedEndpoints: string[];
    };

export interface RoomManagerBootstrap {
  roomManager: RoomManager;
  realtime: RealtimeModeConfig;
  dispose: () => Promise<void>;
}

export const createRoomManagerFromEnv = async (): Promise<RoomManagerBootstrap> => {
  const config = loadBackendConfig();
  const runtimeRegistry = new InMemoryRoomRuntimeRegistry();
  const webPubSubServiceClient = config.webPubSubConnectionString
    ? new WebPubSubServiceClient(config.webPubSubConnectionString, config.webPubSubHub)
    : undefined;
  const realtime: RealtimeModeConfig = webPubSubServiceClient
    ? {
        mode: "webpubsub",
        hub: config.webPubSubHub,
        serviceClient: webPubSubServiceClient,
        allowedEndpoints: [webPubSubServiceClient.endpoint]
      }
    : { mode: "direct" };

  const connections: ConnectionGateway = realtime.mode === "webpubsub"
    ? new WebPubSubConnectionGateway(realtime.serviceClient)
    : new WebSocketConnectionGateway();

  if (!config.redisUrl) {
    const service = new RoomService(
      new InMemoryRoomRepository(),
      runtimeRegistry,
      connections,
      new InMemoryRoomDirectory(),
      new InMemoryRoomMessageBus(),
      config.instanceId,
      config.roomOwnerTtlSeconds
    );
    return {
      roomManager: new RoomManager(service),
      realtime,
      dispose: async () => {}
    };
  }

  const commandClient = createClient({ url: config.redisUrl });
  const eventClient = commandClient.duplicate();
  const subscriptionClient = commandClient.duplicate();

  for (const client of [commandClient, eventClient, subscriptionClient]) {
    client.on("error", (error) => {
      console.error("Redis client error", error);
    });
  }

  try {
    await commandClient.connect();
    await eventClient.connect();
    await subscriptionClient.connect();

    const bus = new RedisRoomMessageBus(commandClient, subscriptionClient);
    await bus.initialize();

    const service = new RoomService(
      new RedisRoomRepository(eventClient, config.roomStateTtlSeconds),
      runtimeRegistry,
      connections,
      new RedisRoomDirectory(eventClient, config.roomOwnerTtlSeconds),
      bus,
      config.instanceId,
      config.roomOwnerTtlSeconds
    );

    return {
      roomManager: new RoomManager(service),
      realtime,
      dispose: async () => {
        await bus.close();
        await Promise.all([subscriptionClient.quit(), eventClient.quit(), commandClient.quit()]);
      }
    };
  } catch (error) {
    await Promise.allSettled([
      subscriptionClient.quit(),
      eventClient.quit(),
      commandClient.quit()
    ]);
    throw error;
  }
};

