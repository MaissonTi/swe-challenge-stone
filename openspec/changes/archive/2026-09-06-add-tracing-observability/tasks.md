## 1. Dependencies & local infra

- [x] 1.1 Add `@opentelemetry/{api,sdk-node,exporter-trace-otlp-proto,instrumentation,instrumentation-http,resources,sdk-trace-base}` to `apps/api/package.json`
- [x] 1.2 Add `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4318`) to `envSchema`
- [x] 1.3 Add a `jaeger` service (`jaegertracing/all-in-one`) to `docker-compose.yml`, exposing the OTLP HTTP receiver (`4318`) and UI (`16686`)
- [x] 1.4 Update `README.md`'s prerequisites/setup steps to mention Jaeger and the UI URL

## 2. `infra/observability/` module

- [x] 2.1 `tracing-setup.ts`: adapt `trace-setup.adapter.ts` — drop the
      Datadog (`DD_AGENT_HOST`) branch, point only at
      `OTEL_EXPORTER_OTLP_ENDPOINT`, replace `console.log` with Nest's
      `Logger`, keep only `HttpInstrumentation` registered
- [x] 2.2 `trace-span.ts` + `trace-span.interface.ts`: adapt
      `trace-span.adapter.ts`/`.interface.ts` — narrow `TraceParams`
      (and the baggage keys) to `userId` only, drop
      `orderId`/`orderType`/`orderPair`
- [x] 2.3 `trace.decorator.ts`: adapt — keep `TraceSpan` (child span,
      no-op outside an active trace); drop `TraceParent` (no message
      broker in this project) and drop `TraceRoot`'s public export (its
      logic moves into the interceptor, task 2.4)
- [x] 2.4 `tracing.interceptor.ts` (new): global `NestInterceptor`
      opening the root span per request, setting `userId` baggage from
      `request.user?.sub` when present (absent on public routes)
- [x] 2.5 Register `TracingInterceptor` globally via `APP_INTERCEPTOR`
      in `infra.module.ts`, alongside the existing `APP_GUARD` entries
- [x] 2.6 `main.ts`: import `infra/observability/tracing-setup` as the
      very first line (ahead of the `dotenv/config` import, which moves
      into `tracing-setup.ts` itself) — verify via a comment why the
      order matters, matching `design.md`
- [x] 2.7 Delete the root-level `observability/` folder (the pasted
      reference kit) once everything needed has been adapted into
      `apps/api/src/infra/observability/`

## 3. Instrument the DynamoDB repositories

- [x] 3.1 `@TraceSpan()` on `DynamoDbUserRepository`'s `findByEmail`,
      `findById`, `create`
- [x] 3.2 `@TraceSpan()` on `DynamoDbProductRepository`'s public methods

## 4. Instrument the Redis-backed adapters

- [x] 4.1 `@TraceSpan()` on `RedisRateLimiter`'s `consume` method
- [x] 4.2 `@TraceSpan()` on `RedisTokenRevocationStore`'s methods
- [x] 4.3 `@TraceSpan()` on `RedisProductListCache`'s `get`/`set`

## 5. Instrument use cases (documented layering exception)

- [x] 5.1 `@TraceSpan()` on every `app/usecases/**/*.usecase.ts`
      `execute()` method (authenticate: login/logout/refresh-token; user:
      register/get-profile; products: create/update/delete/list)
- [x] 5.2 Add a short comment at the top of one representative use case
      (or a shared note) pointing to `design.md`'s documented exception,
      so the import doesn't read as an unnoticed layering slip

## 6. Verification

- [x] 6.1 Run the full existing unit suite unchanged — confirm the
      "no-op outside an active trace" behavior holds (no test needed to
      mock or set up tracing context)
- [x] 6.2 `docker compose up -d`, boot the API, make a real authenticated
      request (e.g. login → list products), confirm in the Jaeger UI
      (`:16686`) that a trace appears with: root span → use case span →
      repository/Redis spans, and the `userId` attribute present —
      verified via Jaeger's query API: `GET /products` produced
      `ProductsController.list` → `usecase.ListProductsUseCase.execute`
      → `cache.RedisProductListCache.get` (miss) →
      `repository.DynamoDbProductRepository.list` →
      `cache.RedisProductListCache.set`, all carrying `user.id`
- [x] 6.3 Confirm a request against a public route (e.g. `/auth/login`
      itself) produces a trace with no `userId` attribute — verified:
      `AuthController.login` → `usecase.LoginUseCase.execute` →
      `repository.DynamoDbUserRepository.findByEmail`, no `user.id` on
      any span
- [x] 6.4 Stop the `jaeger` container and confirm a request still
      succeeds normally (resilience to collector unavailability) —
      verified: `/health` and `/products` both returned 200 in ~3ms with
      Jaeger stopped, no blocking delay
- [x] 6.5 Update `apps/api` test mocks/fixtures only if any existing
      test actually breaks — do not preemptively change tests that
      still pass (nothing broke: all 96 unit tests passed unmodified,
      see task 6.1)

## 7. Documentation

- [x] 7.1 Add a section to `FEAT.md` documenting: why Jaeger/OTLP, why
      manual `@TraceSpan()` over auto-instrumentation, the interceptor
      pattern for the root span, and the documented use-case-layer
      exception to the dependency rule
- [x] 7.2 Update `docs/USO_DE_IA.md` with this change's notes, consistent
      with the rest of the project's documentation
