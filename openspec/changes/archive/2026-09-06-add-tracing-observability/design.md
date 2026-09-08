## Context

See `proposal.md` - Why. The starting point was an existing tracing
kit from another project (`observability/tracing/` at the repo root:
`trace-setup.adapter.ts`, `trace-span.adapter.ts` + its interface,
`trace.decorator.ts`, `index.ts`) built for an order-matching service —
OpenTelemetry Node SDK + a hand-rolled `Trace` class using OTel baggage
to propagate business context (`orderId`/`orderType`/`orderPair`/
`userId`) from a root span down through child spans, plus method
decorators (`TraceRoot`/`TraceParent`/`TraceSpan`) to apply it. This
design adapts that mechanism to this project's domain and layering
rules rather than relocating it unchanged.

This project's `apps/api/src/` is layered Clean Architecture
(`domain/app/infra/presentation`, see `FEAT.md` §3.3) with a strict
dependency rule: `domain` imports nothing external; `app/usecases`
imports only `domain/protocols` interfaces; `infra` implements those
interfaces and may import anything; `presentation` already imports
`infra/` directly for cross-cutting decorators (`@CurrentUser()`,
`@RateLimit()` both come from `infra/auth/` and `infra/rate-limit/`).

## Goals / Non-Goals

**Goals:**
- Every HTTP request produces a trace visible in Jaeger, showing the
  call chain from HTTP entry through use case execution to the
  DynamoDB/Redis calls it made.
- Zero behavior change to existing code paths when no trace is active
  (unit tests keep working unmodified).
- Reuse the adapted `Trace`/`TraceSpan` mechanism uniformly across
  layers rather than mixing it with auto-instrumentation packages.

**Non-Goals:**
- Auto-instrumenting the AWS SDK or `ioredis` via
  `@opentelemetry/instrumentation-aws-sdk`/`-ioredis` - evaluated and
  declined (see Decisions) in favor of the manual decorator everywhere.
- Distributed trace continuation across a message broker (`TraceParent`
  in the source kit) - this API has no broker; dropped entirely.
- Trace sampling strategy, retention, or a production-grade collector
  deployment - Jaeger here is a local Docker Compose service, same
  category as LocalStack/Redis; production tracing infra is deferred
  with the rest of cloud infra (`FEAT.md`, "Fora de escopo").

## Decisions

### Jaeger via native OTLP, no Jaeger-specific exporter
Modern Jaeger (≥1.35) has a built-in OTLP receiver (gRPC `:4317`, HTTP
`:4318`) and its own UI (`:16686`). The source kit's `OTLPTraceExporter`
already exports via OTLP/HTTP - it just needs to point at the local
Jaeger container instead of a Datadog-agent-or-generic-OTLP fallback
chain. The Datadog-specific `DD_AGENT_HOST` branch is removed entirely;
`OTEL_EXPORTER_OTLP_ENDPOINT` (added to `envSchema`, default
`http://localhost:4318`) is the only configuration surface.

### Manual `@TraceSpan()` decorator everywhere, not auto-instrumentation
Considered `@opentelemetry/instrumentation-aws-sdk` and `-ioredis` for
the DynamoDB/Redis layer - they give richer out-of-the-box span
attributes (table name, exact Redis command) with zero code changes.
Declined in favor of the manual decorator for consistency with this
project's established instinct to implement things explicitly rather
than delegate to monkey-patching magic (the same reasoning already
applied to rate-limiting: reproduce WAF logic in-app rather than depend
on it, see `FEAT.md` §5). Trade-off accepted: no automatic `db.system`/
`aws.dynamodb.table_names`-style semantic-convention attributes unless
added by hand inside a decorated method later.

### Root span: global `NestInterceptor`, not a per-controller decorator
The source kit's `TraceRoot` is meant to be applied to each entry-point
method by hand. This project already has a precedent for "applies to
every route without per-route annotation": `JwtAuthGuard` and
`RateLimitGuard` are registered globally via `APP_GUARD` in
`infra.module.ts`. A `TracingInterceptor` registered via
`APP_INTERCEPTOR` follows the same pattern - opens the root span and
sets `userId` baggage (from `request.user?.sub`, present on protected
routes, absent on public ones) for every request with no risk of a new
route being added without tracing. `TraceRoot` as a *method* decorator
is dropped from the public surface; its span-opening logic lives inside
the interceptor instead.

### `@TraceSpan()` at the DynamoDB/Redis layer: no rule conflict
`infra/` can import anything, including its own `infra/observability/`
sibling. Decorating `DynamoDbUserRepository`, `DynamoDbProductRepository`,
`RedisRateLimiter`, `RedisTokenRevocationStore`, and
`RedisProductListCache` methods is a same-layer import, no exception
needed.

### `@TraceSpan()` at the use case layer: documented exception to the layering rule
This is the one real tension. Every `app/usecases/*.usecase.ts` file
today imports only from `domain/` - `usecases.module.ts` is the sole
file in `app/` that touches `infra/`, for DI wiring. Applying
`@TraceSpan()` to `execute()` methods makes each use case file import
from `infra/observability/` directly, breaking that clean line for the
first time.

Two rule-preserving alternatives were considered and declined:
1. **Skip use-case-level spans entirely** - the interceptor's root span
   plus the repository/Redis spans still reconstruct most of what
   happened. Declined because it leaves the single most business-
   meaningful boundary (e.g. "the whole login attempt, including the
   password comparison and token issuance in between repository calls")
   invisible as its own span.
2. **A real port** (`ITracer` in `domain/protocols`, implemented in
   `infra/`, injected via constructor like every other dependency) -
   preserves the rule perfectly. Declined for this pass because it
   forces every traced method body to wrap its logic in a callback
   (`this.tracer.trace(name, async () => { ... })`) instead of a plain
   top-of-method decorator, a more invasive change to already-tested
   use case bodies for a concern that (unlike `IUserRepository` or
   `IHasher`) no use case will ever need to swap at the business level.

**Decision:** accept the exception, explicitly. Tracing is treated as a
cross-cutting *aspect* (observability plumbing), not a *business
dependency* a use case depends on to do its job - the same distinction
that already exists between "port I must go through" (repositories,
hasher, encrypter) and "framework wiring I don't abstract"
(`usecases.module.ts` itself already imports `InfraModule`). This is
recorded here and in `FEAT.md` precisely so it reads as a deliberate,
narrow call - not an unnoticed crack in the architecture.

### `TraceSpan`'s baggage: `userId` only, `TraceParent` dropped
The source kit's baggage (`orderId`/`orderType`/`orderPair`/`userId`)
is Order-domain-specific; only `userId` maps to anything this project
has. `TraceParent` (continue a trace arriving via a message broker's
`traceparent` field) has no use here - this API has no broker, all
entry is synchronous HTTP starting a fresh trace. Both are removed
rather than kept unused.

### Folder: `apps/api/src/infra/observability/`
Not `domain/protocols/` (would require `domain/` to import
`@opentelemetry/api`, an external package - `domain/` currently imports
nothing external, a line worth keeping intact given the one exception
already made above is at the use-case layer, not domain). Not a
top-level `observability/` outside `apps/api/src/` (matches every other
concrete infra concern already organized under `infra/`: `auth/`,
`cache/`, `cryptography/`, `database/`, `env/`, `rate-limit/`,
`swagger/`).

```
apps/api/src/infra/observability/
├── tracing-setup.ts        (from trace-setup.adapter.ts: NodeSDK + OTLP
│                             exporter + HttpInstrumentation only; Nest
│                             Logger instead of console.log; no Datadog
│                             branch; reads env directly - see below)
├── trace-span.ts            (from trace-span.adapter.ts: Trace class,
│                             baggage narrowed to userId)
├── trace-span.interface.ts  (from the .interface.ts file, narrowed)
├── tracing.interceptor.ts   (new: NestInterceptor, root span + baggage)
└── trace.decorator.ts       (from trace.decorator.ts: TraceSpan only -
                              TraceRoot's logic moves into the
                              interceptor, TraceParent removed)
```

### `tracing-setup.ts` reads `process.env` directly, not `EnvService`
`NodeSDK.start()` must run before `NestFactory.create()` even begins -
before Nest's DI container exists, so `EnvService` (itself a Nest
provider) isn't constructible yet. `main.ts` already has this exact
exception today (`process.env.PORT` is read directly, ahead of
`ZodValidationPipe`/everything else). `OTEL_EXPORTER_OTLP_ENDPOINT` is
still declared in `envSchema` for documentation and so any later
in-app code that wants to read it goes through `EnvService` like
everything else - `tracing-setup.ts` itself is the one narrow,
necessary exception, for the same reason `main.ts`'s bootstrap already
is.

### Import order in `main.ts`
OpenTelemetry's HTTP auto-instrumentation patches Node's `http` module
by hooking `require()` - it must run before `http` (or anything that
transitively requires it, like `@nestjs/core`) is first loaded anywhere
in the process, or the patch silently doesn't apply. `main.ts`'s import
of `infra/observability/tracing-setup` becomes the very first line,
ahead of even `import 'dotenv/config'` - no separate `dotenv/config`
import is needed at the top of `main.ts` any more, since
`tracing-setup.ts` itself loads `dotenv/config` as its own first
statement before reading `OTEL_EXPORTER_OTLP_ENDPOINT`, exactly as the
original source kit's `trace-setup.adapter.ts` already did:

```ts
// main.ts
import './infra/observability/tracing-setup'; // side effect: dotenv + NodeSDK.start(), first, always
import { NestFactory } from '@nestjs/core';
...
```

## Risks / Trade-offs

- **[Risk]** No automatic DynamoDB/Redis span attributes (table name,
  exact command) since auto-instrumentation was declined →
  **Mitigation**: accepted trade-off (see Decisions); can add
  `span.setAttribute(...)` calls inside specific decorated methods
  later if a specific investigation needs it, without changing the
  overall approach.
- **[Risk]** `app/usecases/*.usecase.ts` importing `infra/` is a real,
  visible crack in a previously-perfect dependency line →
  **Mitigation**: documented explicitly here and in `FEAT.md` as a
  deliberate exception (cross-cutting aspect, not a business
  dependency), not silently introduced; scoped to exactly this one
  decorator import, nothing else from `infra/` is expected to leak into
  `app/usecases/*.usecase.ts` files under this precedent.
- **[Risk]** Collector (Jaeger) unavailable must not block requests →
  **Mitigation**: `BatchSpanProcessor` exports asynchronously off the
  request path already (source kit's existing behavior); requests
  complete regardless of export success. Verified in tasks, not just
  assumed from reading the library's docs.
- **[Risk]** Import-order mistake in `main.ts` silently disables tracing
  (no error, just no spans) → **Mitigation**: called out explicitly in
  tasks with a concrete verification step (confirm a span actually
  appears in Jaeger for a real request), not just "the import is on top".

## Migration Plan

Purely additive - no existing endpoint, table, or client contract
changes. `docker compose up -d` picks up the new `jaeger` service
alongside `localstack`/`redis`; no data migration. Rollback is deleting
`infra/observability/`, the decorator calls, and the `docker-compose.yml`
service - nothing else in the app depends on tracing being present
(the whole point of "no-op outside an active trace").
