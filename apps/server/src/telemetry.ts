import appInsights from "applicationinsights";

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING?.trim();
const shouldEnableTelemetry = Boolean(connectionString) && process.env.NODE_ENV !== "test";

if (shouldEnableTelemetry) {
  try {
    appInsights
      .setup(connectionString)
      .setAutoCollectConsole(false)
      .setAutoCollectDependencies(false)
      .setAutoCollectExceptions(false)
      .setAutoCollectPerformance(false)
      .setAutoCollectRequests(false)
      .setUseDiskRetryCaching(true)
      .start();

    console.info("Application Insights telemetry enabled");
  } catch (error) {
    console.warn("Application Insights setup failed, continuing without telemetry", error);
  }
}

export const telemetryClient = shouldEnableTelemetry ? appInsights.defaultClient : null;
export const telemetryEnabled = shouldEnableTelemetry;
