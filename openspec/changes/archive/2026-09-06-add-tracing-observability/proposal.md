## Why

The API has no distributed tracing today — diagnosing a slow or failing
request means reading logs and guessing at the call chain (which guard
ran, which repository query fired, whether the rate-limiter or cache hit
Redis). Adding OpenTelemetry tracing exported to a local Jaeger makes the
actual call chain (HTTP → use case → repository/cache) visible per
request, which matters for a project that already leans on fail-open
degradation (Redis unavailability) that's otherwise silent unless you're
watching the warning logs.

## What Changes

- New `infra/observability/` module in `apps/api`: OpenTelemetry Node SDK
  bootstrap, exporting spans via OTLP HTTP to a local Jaeger instance.
- A global NestJS interceptor opens one root span per HTTP request,
  carrying the authenticated user's id (when present) as trace baggage.
- A `@TraceSpan()` method decorator, applied manually (no auto-
  instrumentation packages for AWS SDK/ioredis) to: DynamoDB repository
  methods, Redis-backed adapters (rate limiter, token revocation store,
  product list cache), and use case `execute()` methods. It is a no-op
  (zero overhead, no span) when called outside an active trace, so
  existing unit tests that construct these classes directly and call
  them without a request context are unaffected.
- **Documented, deliberate exception to the existing layering rule**:
  `app/usecases/*.usecase.ts` will import `@TraceSpan()` from `infra/`
  directly — the first case of a concrete use case depending on
  something outside `domain/`. Justified because tracing is a
  cross-cutting operational aspect, not a business dependency use cases
  should ever swap via a port (see `design.md`).
- `docker-compose.yml`: new `jaeger` service (`jaegertracing/all-in-one`,
  OTLP HTTP receiver + UI).
- `envSchema`: new `OTEL_EXPORTER_OTLP_ENDPOINT` variable.

## Capabilities

### New Capabilities
- `observability`: distributed tracing of API requests, exported via
  OTLP to Jaeger, covering HTTP entry, use case execution, and
  DynamoDB/Redis calls.

### Modified Capabilities
(none — this is a purely operational addition; no existing requirement's
externally observable behavior changes)

## Impact

- New dependencies in `apps/api`: `@opentelemetry/api`, `sdk-node`,
  `exporter-trace-otlp-proto`, `instrumentation-http`, `resources`,
  `sdk-trace-base`.
- New local infra dependency: Jaeger container (Docker Compose only —
  no change to what's deployed where in production, which remains
  deferred per `FEAT.md`, "Fora de escopo").
- Touches every `app/usecases/*.usecase.ts` file (adds a decorator),
  every DynamoDB repository, and the three Redis-backed infra adapters
  (rate limiter, revocation store, product list cache) — decoration
  only, no behavior change to what they return.
- `main.ts`'s import order changes: the tracing bootstrap module must be
  the first import, ahead of `@nestjs/core`, or HTTP auto-instrumentation
  silently fails to patch anything (see `design.md`).
