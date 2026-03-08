import { metrics, trace } from "@opentelemetry/api";
import type { Request, Response } from "express";
import { telemetryEnabled } from "./telemetry.js";

type LogLevel = "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const toStringProps = (context: LogContext): Record<string, string> =>
  Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, value === undefined ? "" : String(value)])
  );

const formatLog = (level: LogLevel, message: string, context: LogContext = {}) =>
  JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context
  });

const tracer = trace.getTracer("galaxy-shooter-server");
const meter = metrics.getMeter("galaxy-shooter-server");

const gameMetrics = {
  roomsCreated: meter.createCounter("game.rooms_created", { description: "Total rooms created" }),
  matchesStarted: meter.createCounter("game.matches_started", { description: "Total matches started" }),
  matchesCompleted: meter.createCounter("game.matches_completed", { description: "Total matches completed" }),
  playersConnected: meter.createCounter("game.players_connected", { description: "Total player connections" }),
  playersDisconnected: meter.createCounter("game.players_disconnected", { description: "Total player disconnections" }),
  tickDuration: meter.createHistogram("game.tick_duration_ms", { description: "Game tick processing time in ms" }),
};

export { gameMetrics };

export const logInfo = (message: string, context?: LogContext) => {
  console.info(formatLog("info", message, context));
  if (telemetryEnabled) {
    const span = tracer.startSpan("log.info");
    span.setAttribute("log.message", message);
    if (context) {
      for (const [k, v] of Object.entries(toStringProps(context))) {
        span.setAttribute(`log.${k}`, v);
      }
    }
    span.end();
  }
};

export const logWarn = (message: string, context?: LogContext) => {
  console.warn(formatLog("warn", message, context));
  if (telemetryEnabled) {
    const span = tracer.startSpan("log.warn");
    span.setAttribute("log.message", message);
    if (context) {
      for (const [k, v] of Object.entries(toStringProps(context))) {
        span.setAttribute(`log.${k}`, v);
      }
    }
    span.end();
  }
};

export const logError = (message: string, error?: unknown, context: LogContext = {}) => {
  const errorContext = error instanceof Error
    ? {
        errorName: error.name,
        errorMessage: error.message,
        ...(process.env.NODE_ENV !== "production" ? { errorStack: error.stack } : {})
      }
    : error !== undefined
      ? { errorValue: String(error) }
      : {};

  const fullContext = { ...context, ...errorContext };
  console.error(formatLog("error", message, fullContext));

  if (telemetryEnabled) {
    const span = tracer.startSpan("log.error");
    span.setAttribute("log.message", message);
    for (const [k, v] of Object.entries(toStringProps(fullContext))) {
      span.setAttribute(`log.${k}`, v);
    }
    if (error instanceof Error) {
      span.recordException(error);
    }
    span.end();
  }
};

export const requestContext = (req: Request, res: Response) => ({
  requestId: res.locals.requestId as string | undefined,
  method: req.method,
  path: req.originalUrl,
  ip: req.ip
});

export const trackRequest = (req: Request, res: Response, durationMs: number) => {
  if (!telemetryEnabled) return;
  const span = tracer.startSpan(`HTTP ${req.method} ${req.route?.path ?? req.path}`);
  span.setAttribute("http.method", req.method);
  span.setAttribute("http.url", `${req.protocol}://${req.get("host")}${req.originalUrl}`);
  span.setAttribute("http.status_code", res.statusCode);
  span.setAttribute("http.duration_ms", durationMs);
  const ctx = requestContext(req, res);
  for (const [k, v] of Object.entries(toStringProps(ctx))) {
    span.setAttribute(`request.${k}`, v);
  }
  span.end();
};

