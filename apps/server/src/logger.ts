import type { Request, Response } from "express";
import { telemetryClient } from "./telemetry.js";

type LogLevel = "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const severityMap: Record<LogLevel, number> = {
  info: 1,
  warn: 2,
  error: 3
};

const formatLog = (level: LogLevel, message: string, context: LogContext = {}) =>
  JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context
  });

const trackTrace = (level: LogLevel, message: string, context: LogContext = {}) => {
  telemetryClient?.trackTrace({
    message,
    severity: severityMap[level],
    properties: Object.fromEntries(
      Object.entries(context).map(([key, value]) => [key, value === undefined ? "" : String(value)])
    )
  });
};

export const logInfo = (message: string, context?: LogContext) => {
  console.info(formatLog("info", message, context));
  trackTrace("info", message, context);
};

export const logWarn = (message: string, context?: LogContext) => {
  console.warn(formatLog("warn", message, context));
  trackTrace("warn", message, context);
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
  telemetryClient?.trackException({
    exception: error instanceof Error ? error : new Error(message),
    properties: Object.fromEntries(
      Object.entries(fullContext).map(([key, value]) => [key, value === undefined ? "" : String(value)])
    )
  });
  trackTrace("error", message, fullContext);
};

export const requestContext = (req: Request, res: Response) => ({
  requestId: res.locals.requestId as string | undefined,
  method: req.method,
  path: req.originalUrl,
  ip: req.ip
});

export const trackRequest = (req: Request, res: Response, durationMs: number) => {
  telemetryClient?.trackRequest({
    name: `${req.method} ${req.route?.path ?? req.path}`,
    url: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
    resultCode: String(res.statusCode),
    success: res.statusCode < 500,
    duration: durationMs,
    time: new Date(Date.now() - durationMs),
    properties: Object.fromEntries(
      Object.entries(requestContext(req, res)).map(([key, value]) => [key, value === undefined ? "" : String(value)])
    )
  });
};

