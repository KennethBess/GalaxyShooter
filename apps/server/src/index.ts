import "./telemetry.js";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebPubSubEventHandler } from "@azure/web-pubsub-express";
import type {
  ClientMessage,
} from "@shared/index";
import { TICK_RATE } from "@shared/index";
import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { WebSocketServer } from "ws";
import { gameMetrics, logError, logInfo, requestContext, trackRequest } from "./logger.js";
import { createRoomManagerFromEnv } from "./roomManagerFactory.js";
import { normalizeRoomCode } from "./runtime.js";
import { parseControllerNegotiateRequest, parseCreateRoomRequest, parseJoinRoomRequest, parseLeaderboardMode, parseRealtimeNegotiationRequest, parseRegisterRequest, parseResetMode } from "./validation.js";

const app = express();
app.set("trust proxy", 1);

const { roomManager, leaderboard, players, realtime, dispose } = await createRoomManagerFromEnv();
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
        const role = req.queries?.role?.[0] ?? "player";
        const playerId = req.context.userId;
        if (!roomCode || !playerId) {
          res.fail(400, "Missing room code or player ID");
          return;
        }

        res.setState("roomCode", roomCode);
        res.setState("role", role);
        if (role === "controller") {
          res.setState("targetPlayerId", req.queries?.targetPlayerId?.[0] ?? "");
        }
        const requestedProtocol = req.subprotocols?.find((protocol) => protocol === "json.webpubsub.azure.v1");
        logInfo("Web PubSub connect accepted", { roomCode, playerId, role });
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
      const role = String(req.context.states.role ?? "player");
      if (!roomCode || !playerId) {
        return;
      }

      if (role === "controller") {
        // Controller pairing happens when the client sends a controller_connect message,
        // not here, to avoid race conditions with message ordering.
        logInfo("Web PubSub controller connected (awaiting pairing message)", { roomCode, playerId });
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
      const role = String(req.context.states.role ?? "player");
      if (!roomCode || !playerId) {
        return;
      }

      if (role === "controller") {
        logInfo("Web PubSub controller disconnected", { controllerId: playerId });
        // No cleanup needed — Web PubSub controllers use connection state, not in-memory bindings.
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
      const role = String(req.context.states.role ?? "player");
      if (!roomCode || !playerId) {
        res.fail(400, "Missing room context");
        return;
      }

      const clientMessage = req.data as ClientMessage;
      logInfo("Web PubSub client message received", {
        roomCode,
        playerId,
        role,
        eventName: req.context.eventName,
        messageType: clientMessage.type
      });

      // Controller messages: use connection state (targetPlayerId, roomCode) directly
      // instead of in-memory bindings, since Web PubSub can route events to any server instance.
      if (role === "controller") {
        const targetPlayerId = String(req.context.states.targetPlayerId ?? "");

        if (clientMessage.type === "controller_connect") {
          // Validate player exists and send pairing confirmation
          void (async () => {
            try {
              const state = await roomManager.validatePlayer(roomCode, targetPlayerId);
              const player = state.players.find((p) => p.playerId === targetPlayerId);
              if (!player) throw new Error("Player not found in room");
              logInfo("Web PubSub controller paired", { controllerId: playerId, targetPlayerId });
              res.success();
              await realtime.serviceClient.sendToUser(playerId, {
                type: "controller_paired",
                payload: { playerId: targetPlayerId, playerName: player.name }
              }, { contentType: "application/json" });
            } catch (error) {
              logError("Web PubSub controller pairing failed", error, { controllerId: playerId, targetPlayerId });
              res.fail(400, error instanceof Error ? error.message : "Pairing failed");
            }
          })();
          return;
        }

        // Route input/bomb through the normal distributed command path (handles multi-instance)
        res.success();
        if (!targetPlayerId) {
          logError("Web PubSub controller missing targetPlayerId", new Error("No targetPlayerId in connection state"), { controllerId: playerId });
          return;
        }
        void roomManager.handleMessage(roomCode, targetPlayerId, clientMessage)
          .catch((error) => {
            logError("Web PubSub controller message failed", error, {
              controllerId: playerId,
              targetPlayerId,
              messageType: clientMessage.type
            });
          });
        return;
      }

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

const SAFE_REQUEST_ID_RE = /^[a-zA-Z0-9-]{1,64}$/;

app.use((req, res, next) => {
  const incoming = req.header("x-request-id");
  res.locals.requestId = (incoming && SAFE_REQUEST_ID_RE.test(incoming)) ? incoming : randomUUID();
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
    const body = parseCreateRoomRequest(req.body);
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

app.get("/api/leaderboard", async (req, res) => {
  try {
    const mode = parseLeaderboardMode(req.query.mode);
    const entries = await leaderboard.getTopScores(mode);
    res.status(200).json(entries);
  } catch (error) {
    logError("Leaderboard fetch failed", error);
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid mode parameter" });
  }
});

app.delete("/api/leaderboard/:id", async (req, res) => {
  try {
    const deleted = await leaderboard.deleteEntry(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: "Leaderboard entry not found" });
      return;
    }
    res.status(204).end();
  } catch (error) {
    logError("Leaderboard delete failed", error);
    res.status(500).json({ message: error instanceof Error ? error.message : "Unable to delete entry" });
  }
});

app.delete("/api/leaderboard", async (req, res) => {
  try {
    const mode = parseResetMode(req.query.mode);
    await leaderboard.reset(mode);
    res.status(200).json({ cleared: mode });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ message: "Invalid mode parameter — use campaign, survival, or all" });
      return;
    }
    logError("Leaderboard reset failed", error);
    res.status(500).json({ message: error instanceof Error ? error.message : "Reset failed" });
  }
});

app.post("/register", async (req, res) => {
  try {
    const body = parseRegisterRequest(req.body);
    const result = await players.register(body.fullName, body.email, body.phone);
    const record = await players.getById(result.id);
    res.status(result.existing ? 200 : 201).json({
      playerId: result.id,
      fullName: record?.fullName ?? body.fullName,
    });
  } catch (error) {
    logError("Registration failed", error);
    const message = error instanceof Error ? error.message : "Registration failed";
    res.status(400).json({ message });
  }
});

app.get("/players/export", async (_req, res) => {
  try {
    const allPlayers = await players.getAll();
    const csvEscape = (field: string) => {
      if (field.includes(",") || field.includes('"') || field.includes("\n")) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };
    const header = "Full Name,Email,Phone,Registered At";
    const rows = allPlayers.map((p) =>
      [csvEscape(p.fullName), csvEscape(p.email), csvEscape(p.phone ?? ""), p.registeredAt].join(",")
    );
    const csv = [header, ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="players.csv"');
    res.send(csv);
  } catch (error) {
    logError("Player export failed", error);
    res.status(500).json({ message: error instanceof Error ? error.message : "Export failed" });
  }
});

app.post("/rooms/:code/join", async (req, res) => {
  try {
    const body = parseJoinRoomRequest(req.body);
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
    const body = parseRealtimeNegotiationRequest(req.body);
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

app.post("/realtime/negotiate/controller", async (req, res) => {
  try {
    const body = parseControllerNegotiateRequest(req.body);
    const roomCode = normalizeRoomCode(body.roomCode);
    await roomManager.validatePlayer(roomCode, body.playerId);

    if (realtime.mode === "webpubsub") {
      const token = await realtime.serviceClient.getClientAccessToken({ userId: `ctrl_${body.playerId}` });
      const url = new URL(token.url);
      url.searchParams.set("roomCode", roomCode);
      url.searchParams.set("role", "controller");
      url.searchParams.set("targetPlayerId", body.playerId);
      res.status(200).json({
        mode: "webpubsub",
        hub: realtime.hub,
        url: url.toString(),
        protocol: "json.webpubsub.azure.v1"
      });
      return;
    }

    const directUrl = new URL("/controller-ws", `${req.protocol === "https" ? "wss" : "ws"}://${req.get("host")}`);
    directUrl.searchParams.set("code", roomCode);
    directUrl.searchParams.set("playerId", body.playerId);
    res.status(200).json({ mode: "direct", url: directUrl.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to negotiate controller connection";
    const status = message === "Room not found" ? 404 : message === "Player not found in room" ? 400 : 400;
    logError("Controller negotiation failed", error);
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

const controllerWss = realtime.mode === "direct" ? new WebSocketServer({ server, path: "/controller-ws" }) : null;

controllerWss?.on("connection", async (socket, request) => {
  const url = new URL(request.url ?? "", "http://localhost");
  const roomCode = url.searchParams.get("code")?.toUpperCase();
  const targetPlayerId = url.searchParams.get("playerId");

  if (!roomCode || !targetPlayerId) {
    socket.close(1008, "Missing room code or player ID");
    return;
  }

  const controllerId = randomUUID();

  try {
    const playerName = await roomManager.connectController(roomCode, targetPlayerId, controllerId);
    logInfo("Controller websocket connected", { roomCode, targetPlayerId, controllerId });
    socket.send(JSON.stringify({ type: "controller_paired", payload: { playerId: targetPlayerId, playerName } }));
  } catch (error) {
    logError("Controller websocket connection failed", error, { roomCode, targetPlayerId });
    socket.close(1008, error instanceof Error ? error.message : "Connection rejected");
    return;
  }

  socket.on("message", async (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as ClientMessage;
      await roomManager.handleControllerMessage(controllerId, message);
    } catch (error) {
      logError("Controller websocket message failed", error, { controllerId });
    }
  });

  socket.on("close", () => {
    logInfo("Controller websocket disconnected", { controllerId });
    roomManager.disconnectController(controllerId);
  });
});

const TICK_MS = 1000 / TICK_RATE;
let tickTimer: ReturnType<typeof setTimeout>;
const scheduleTick = (delay: number = TICK_MS) => {
  tickTimer = setTimeout(async () => {
    const tickStart = Date.now();
    try {
      await roomManager.tick(TICK_MS);
    } catch (error) {
      logError("Room tick failed", error);
    }
    const tickDuration = Date.now() - tickStart;
    gameMetrics.tickDuration.record(tickDuration);
    scheduleTick(Math.max(1, TICK_MS - tickDuration));
  }, delay);
};
scheduleTick();

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  clearTimeout(tickTimer);
  wss?.close();
  controllerWss?.close();
  server.close();
  await dispose();

  // Flush OpenTelemetry before exit
  try {
    const { trace } = await import("@opentelemetry/api");
    const provider = trace.getTracerProvider();
    if ("forceFlush" in provider && typeof provider.forceFlush === "function") {
      await (provider.forceFlush as () => Promise<void>)();
    }
  } catch { /* best effort */ }
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

