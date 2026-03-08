import { useAzureMonitor } from "@azure/monitor-opentelemetry";

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING?.trim();
const shouldEnableTelemetry = Boolean(connectionString) && process.env.NODE_ENV !== "test";

if (shouldEnableTelemetry) {
  try {
    useAzureMonitor({ azureMonitorExporterOptions: { connectionString } });
    console.info("Application Insights telemetry enabled (OpenTelemetry)");
  } catch (error) {
    console.warn("Application Insights setup failed, continuing without telemetry", error);
  }
}

export const telemetryEnabled = shouldEnableTelemetry;
