/**
 * Bootstraps OpenTelemetry tracing. This file's first statement loads
 * `dotenv/config` so `OTEL_EXPORTER_OTLP_ENDPOINT` can be read before
 * the SDK starts.
 *
 * No auto-instrumentation is registered: every span in this service is
 * opened manually - the request's root span via `@TraceRoot()` on each
 * controller handler (see `trace-root.decorator.ts`), and use
 * case/DynamoDB/Redis child spans via `@TraceSpan()` (see
 * `trace.decorator.ts`). Since nothing here patches Node's `http`
 * module via `require()`, this module no longer needs to be the first
 * import in `main.ts`. See the design.md on the
 * `refine-observability-and-web-fixes` change.
 *
 * Adapted from a tracing kit built for a different service (an
 * order-matching one): removed the Datadog agent fallback (this
 * project always uses only the OTLP endpoint below) and swapped
 * `console.log` for Nest's `Logger`.
 */
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { ProxyTracerProvider, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

const SERVICE_NAME = 'stone-api';
const OTLP_ENDPOINT = `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318'}/v1/traces`;

const logger = new Logger('Tracing');

const traceExporter = new OTLPTraceExporter({ url: OTLP_ENDPOINT });

// Export off the request path - a slow/unreachable collector never
// delays anything the client is waiting on (see specs/observability:
// "Resilience to Collector Unavailability").
const batchProcessor = new BatchSpanProcessor(traceExporter, {
  scheduledDelayMillis: 1000,
  maxQueueSize: 2048,
  maxExportBatchSize: 512,
  exportTimeoutMillis: 30000,
});

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': SERVICE_NAME,
    'deployment.environment': process.env.STAGE ?? 'dev',
  }),
  spanProcessor: batchProcessor,
  // No auto-instrumentation: every span is opened manually via
  // @TraceRoot() / @TraceSpan(). This also removes the require() hook
  // that used to force this module to load before @nestjs/core.
  instrumentations: [],
});

sdk.start();
logger.log(
  `OpenTelemetry tracing started for ${SERVICE_NAME} -> ${OTLP_ENDPOINT}`,
);

process.on('SIGTERM', async () => {
  try {
    await sdk.shutdown();
    trace.setGlobalTracerProvider(new ProxyTracerProvider());
    logger.log('Tracing shut down cleanly');
  } catch (err) {
    logger.error('Error shutting down tracing', err as Error);
  } finally {
    // main.ts doesn't call app.enableShutdownHooks(), so nothing else
    // ends the process on SIGTERM - preserve that behavior instead of
    // leaving the process hanging once we add our own listener.
    process.exit(0);
  }
});
