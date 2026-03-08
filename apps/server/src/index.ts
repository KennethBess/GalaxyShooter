import "./telemetry.js";
import { WebPubSubEventHandler } from "@azure/web-pubsub-express";
import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import type {
  ClientMessage,
  CreateRoomRequest,
  JoinRoomRequest,
  RealtimeNegotiationRequest
} from "../../../packages/shared/src/index.js";
import { TICK_RATE } from "../../../packages/shared/src/index.js";
import { logError, logInfo, requestContext, trackRequest } from "./logger.js";
import { normalizeRoomCode } from "./runtime.js";
import { createRoomManagerFromEnv } from "./roomManagerFactory.js";

const app = express();
app.set("trust proxy", 1);

const { roomManager, realtime, dispose } = await createRoomManagerFromEnv();
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (realtime.mode === "webpubsub") {
  const handler = new WebPubSubEventHandler(realtime.hub, {
    allowedEndpoints: realtime.allowedEndpoints,
    handleConnect: (req, res) => {
      try {
        const roomCode = normalizeRoomCode(req.queries?.roomCode?.[0] ?? "");
        const playerId = req.context.userId;
        if (!roomCode || !playerId) {
          res.fail(400, "Missing room code or player ID");
          return;
        }

        res.setState("roomCode", roomCode);
        const requestedProtocol = req.subprotocols?.find((protocol) => protocol === "json.webpubsub.azure.v1");
        logInfo("Web PubSub connect accepted", { roomCode, playerId });
        res.success({ userId: playerId, subprotocol: requestedProtocol });
      } catch (error) {
        logError("Web PubSub connect rejected", error, {
          roomCode: req.queries?.roomCode?.[0],
          playerId: req.context.userId
        });
        res.fail(401, error instanceof Error ? error.message : "Connection rejected");
      }
    },
    onConnected: (req) => {
      const roomCode = String(req.context.states.roomCode ?? "");
      const playerId = req.context.userId;
      if (!roomCode || !playerId) {
        return;
      }

      logInfo("Web PubSub connected", { roomCode, playerId });
      void roomManager.connectPlayer(roomCode, playerId).catch((error) => {
        logError("Web PubSub connectPlayer failed", error, { roomCode, playerId });
      });
    },
    onDisconnected: (req) => {
      const roomCode = String(req.context.states.roomCode ?? "");
      const playerId = req.context.userId;
      if (!roomCode || !playerId) {
        return;
      }

      logInfo("Web PubSub disconnected", { roomCode, playerId });
      void roomManager.disconnectPlayer(roomCode, playerId).catch((error) => {
        logError("Web PubSub disconnectPlayer failed", error, { roomCode, playerId });
      });
    },
    handleUserEvent: (req, res) => {
      if (req.context.eventName !== "client-message") {
        res.fail(400, `Unsupported event ${req.context.eventName}`);
        return;
      }
      if (req.dataType !== "json" || typeof req.data !== "object" || req.data === null) {
        res.fail(400, "Realtime messages must be JSON");
        return;
      }

      const roomCode = String(req.context.states.roomCode ?? "");
      const playerId = req.context.userId;
      if (!roomCode || !playerId) {
        res.fail(400, "Missing room context");
        return;
      }

      const clientMessage = req.data as ClientMessage;
      logInfo("Web PubSub client message received", {
        roomCode,
        playerId,
        eventName: req.context.eventName,
        messageType: clientMessage.type
      });
      res.success();
      void roomManager.handleMessage(roomCode, playerId, clientMessage)
        .then(() => {
          logInfo("Web PubSub client message processed", {
            roomCode,
            playerId,
            messageType: clientMessage.type
          });
        })
        .catch((error) => {
          logError("Web PubSub message failed", error, {
            roomCode,
            playerId,
            eventName: req.context.eventName,
            messageType: clientMessage.type
          });
        });
    }
  });

  app.use(handler.getMiddleware());
}

app.use(express.json());
app.use(compression());
app.use(cors(allowedOrigins.length === 0 ? undefined : {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by CORS"));
  }
}));

app.use((req, res, next) => {
  if ((req.method === "POST" || req.method === "PUT" || req.method === "PATCH") &&
    !req.is("application/json")) {
    res.status(415).json({ message: "Content-Type must be application/json" });
    return;
  }
  next();
});

const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" }
});
app.use("/rooms", apiLimiter);
app.use("/realtime", apiLimiter);

app.use((req, res, next) => {
  res.locals.requestId = req.header("x-request-id") ?? randomUUID();
  res.setHeader("x-request-id", res.locals.requestId);
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    trackRequest(req, res, durationMs);
    logInfo("HTTP request completed", {
      ...requestContext(req, res),
      statusCode: res.statusCode,
      durationMs
    });
  });

  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, realtime: realtime.mode });
});

app.post("/rooms", async (req, res) => {
  try {
    const body = req.body as CreateRoomRequest;
    if (!body || typeof body.playerName !== "string" || !body.playerName.trim()) {
      res.status(400).json({ message: "playerName is required" });
      return;
    }
    res.status(201).json(await roomManager.createRoom(body.playerName, body.shipId));
  } catch (error) {
    logError("Create room failed", error);
    res.status(400).json({ message: error instanceof Error ? error.message : "Unable to create room" });
  }
});

app.get("/rooms/open", async (req, res) => {
  try {
    res.status(200).json(await roomManager.listOpenRooms());
  } catch (error) {
    logError("List open rooms failed", error);
    res.status(500).json({ message: error instanceof Error ? error.message : "Unable to list open rooms" });
  }
});

app.post("/rooms/:code/join", async (req, res) => {
  try {
    const body = req.body as JoinRoomRequest;
    if (!body || typeof body.playerName !== "string" || !body.playerName.trim()) {
      res.status(400).json({ message: "playerName is required" });
      return;
    }
    res.status(200).json(await roomManager.joinRoom(req.params.code, body.playerName, body.shipId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to join room";
    const status = message === "Room not found" ? 404 : message === "Room is full" ? 409 : 400;
    logError("Join room failed", error, { roomCode: req.params.code, status });
    res.status(status).json({ message });
  }
});

app.post("/realtime/negotiate", async (req, res) => {
  try {
    const body = req.body as RealtimeNegotiationRequest;
    const roomCode = normalizeRoomCode(body.roomCode);
    await roomManager.validatePlayer(roomCode, body.playerId);

    if (realtime.mode === "webpubsub") {
      const token = await realtime.serviceClient.getClientAccessToken({ userId: body.playerId });
      const url = new URL(token.url);
      url.searchParams.set("roomCode", roomCode);
      res.status(200).json({
        mode: "webpubsub",
        hub: realtime.hub,
        url: url.toString(),
        protocol: "json.webpubsub.azure.v1"
      });
      return;
    }

    const directUrl = new URL("/rooms", `${req.protocol === "https" ? "wss" : "ws"}://${req.get("host")}`);
    directUrl.searchParams.set("code", roomCode);
    directUrl.searchParams.set("playerId", body.playerId);
    res.status(200).json({ mode: "direct", url: directUrl.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to negotiate realtime connection";
    const status = message === "Room not found" ? 404 : 400;
    logError("Realtime negotiation failed", error);
    res.status(status).json({ message });
  }
});

const server = createServer(app);
const wss = realtime.mode === "direct" ? new WebSocketServer({ server, path: "/rooms" }) : null;

wss?.on("connection", async (socket, request) => {
  const url = new URL(request.url ?? "", "http://localhost");
  const roomCode = url.searchParams.get("code")?.toUpperCase();
  const playerId = url.searchParams.get("playerId");

  if (!roomCode || !playerId) {
    logInfo("Direct websocket rejected", { reason: "missing_room_or_player" });
    socket.close(1008, "Missing room code or player ID");
    return;
  }

  try {
    await roomManager.connectPlayer(roomCode, playerId, socket);
    logInfo("Direct websocket connected", { roomCode, playerId });
  } catch (error) {
    logError("Direct websocket connection failed", error, { roomCode, playerId });
    socket.close(1008, error instanceof Error ? error.message : "Connection rejected");
    return;
  }

  socket.on("message", async (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as ClientMessage;
      await roomManager.handleMessage(roomCode, playerId, message);
    } catch (error) {
      logError("Direct websocket message failed", error, { roomCode, playerId });
      socket.send(JSON.stringify({ type: "error", payload: { message: error instanceof Error ? error.message : "Invalid message" } }));
    }
  });

  socket.on("close", () => {
    logInfo("Direct websocket disconnected", { roomCode, playerId });
    void roomManager.disconnectPlayer(roomCode, playerId).catch((error) => {
      logError("Direct websocket disconnectPlayer failed", error, { roomCode, playerId });
    });
  });
});

const tickInterval = setInterval(() => {
  void roomManager.tick(1000 / TICK_RATE).catch((error) => {
    logError("Room tick failed", error);
  });
}, 1000 / TICK_RATE);

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  clearInterval(tickInterval);
  wss?.close();
  server.close();
  await dispose();
};

process.on("SIGINT", () => {
  logInfo("Received SIGINT, shutting down");
  void shutdown();
});
process.on("SIGTERM", () => {
  logInfo("Received SIGTERM, shutting down");
  void shutdown();
});
process.on("uncaughtException", (error) => {
  logError("Uncaught exception", error);
});
process.on("unhandledRejection", (reason) => {
  logError("Unhandled rejection", reason);
});

const PORT = Number(process.env.PORT ?? 3001);
server.listen(PORT, "0.0.0.0", () => {
  logInfo("Galaxy Shooter server started", {
    port: PORT,
    realtimeMode: realtime.mode
  });
});

