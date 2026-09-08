## Context

See `proposal.md` - Why. Three current-state facts shape this design:

1. **Tracing.** `tracing-setup.ts` runs `NodeSDK` with a single
   `HttpInstrumentation`. It contributes exactly one HTTP-server span
   per request (outgoing spans are suppressed via
   `ignoreOutgoingRequestHook: () => true`) and a `requestHook` that
   renames it to `METHOD /url`. The actual per-request root span used by
   `@TraceSpan()` child spans is opened separately by
   `TracingInterceptor` (`APP_INTERCEPTOR`), which reads
   `request.user?.sub` and sets `userId` + a "trace is active" marker
   into OTel baggage. `@TraceSpan()` child spans are a no-op unless that
   marker is present. `main.ts` imports `tracing-setup` before anything
   else because `HttpInstrumentation` patches `require()`.

2. **Product-list cache.** `ListProductsUseCase` is cache-aside over
   `IProductListCache` (Redis), key
   `products:list:<category>:<namePrefix>:<cursor>`, TTL 45s. The
   interface exposes only `get`/`set`. No create/update/delete use case
   touches the cache, so a write is invisible to listings for up to 45s.
   The web-spa e2e suite already documents and works around this.

3. **Web HTTP client.** `apps/web/src/lib/http-client.ts` is a `ky`
   instance: `beforeRequest` attaches the bearer token, `afterResponse`
   catches 401, runs a single-flight refresh (`refreshSessionOnce`), and
   retries the original request once with a marker header. Two service
   modules, one `HTTPError` check in `SignInPage`, and a `fetch`-stubbing
   unit test depend on `ky` semantics.

The layering rule (`FEAT.md` §3.3) already has one accepted exception:
`app/usecases/*` importing `infra/observability/` for `@TraceSpan()`.

## Goals / Non-Goals

**Goals:**
- Root span opened by an explicit decorator on each controller handler,
  with no auto-instrumentation package and no `main.ts` import-order
  constraint.
- A write to the product catalog is reflected in the very next listing
  read, without weakening the cache's fail-open behavior.
- `axios` replaces `ky` with byte-for-byte equivalent client behavior
  (same auth header, same single-flight 401 refresh + one retry).

**Non-Goals:**
- Changing the trace export format, the span hierarchy below the root
  (use-case / data-store spans via `@TraceSpan()` are untouched), or the
  Jaeger/OTLP wiring.
- Per-key/selective cache invalidation - all listings are invalidated on
  any write (see Decisions).
- Reworking the SPA's React Query invalidation - it is already correct;
  the visible bug is entirely the API cache.
- Adding `db.system`-style semantic attributes (already a declined
  non-goal of `add-tracing-observability`).

## Decisions

### `@TraceRoot()` method decorator, applied to every controller handler
Replaces `TracingInterceptor` + `APP_INTERCEPTOR`. This reverses the
`add-tracing-observability` design decision "Root span: global
NestInterceptor, not a per-controller decorator". Rationale for the
reversal: the interceptor's only advantage was that a new route can't be
added untraced; the cost was a global provider plus the impression that
tracing is framework-injected magic. The team wants the root span
opened explicitly at the point it conceptually begins.

- **Shape.** `@TraceRoot()` wraps the handler like `@TraceSpan()` does,
  but calls `Trace.spanRoot({ userId })` instead of `Trace.span()`, and
  runs the original method inside `context.with(span.context(), ...)` so
  every downstream `@TraceSpan()` sees the active-trace baggage marker.
- **Reading `userId`.** A method decorator does not receive
  `ExecutionContext`. The handler's own `req`/`@CurrentUser()` argument
  is the source. Chosen approach: `@TraceRoot()` takes an optional
  extractor `(args) => string | undefined`; each protected handler
  passes `@TraceRoot(args => (args[n] as VerifiedTokenPayload)?.sub)`
  pointing at its `@CurrentUser()` parameter, public handlers pass
  nothing. Alternative considered - reflecting on Nest param metadata to
  auto-find the user - rejected as reintroducing the magic we're
  removing.
- **Coverage.** All three controllers
  (`products`, `auth`, `health`) get the decorator on every handler.
  `health` is `@Public()` and passes no extractor. A lint/checklist item
  in tasks guards against a future handler missing it - the accepted
  trade-off of dropping the global interceptor.

### Remove `HttpInstrumentation`; keep `NodeSDK`
`NodeSDK` stays (it wires the OTLP exporter, resource attributes, and
`BatchSpanProcessor` cleanly) but with `instrumentations: []`. Dropping
`@opentelemetry/instrumentation` and `@opentelemetry/instrumentation-http`
removes the `require()` patching, so:
- `main.ts` imports `tracing-setup` in normal order; `import
  'dotenv/config'` returns to `main.ts` explicitly.
- The lost `METHOD /url` span name is replaced by `@TraceRoot()` naming
  the root span `ClassName.handler` (matching what the interceptor did)
  or `METHOD /route` if the extractor is given the request - decided in
  tasks, not spec-relevant.
- One HTTP-server span per request disappears from each trace; the
  `@TraceRoot()` span becomes the literal root. Spec "HTTP Request Root
  Span" still holds.

### Dead code removal scope
`TraceReturnType` (exported, zero references) is deleted. `@TraceSpan()`
loses its unused `name` option and the `| string` half of the `prefix`
union - every call site passes `{ prefix: TracePrefixEnum.X }`.
`ITrace` is kept: it still documents the `Trace` contract and costs
nothing. If removing `name` later proves shortsighted it is a trivial
re-add; nothing external depends on the option today.

### Cache invalidation: generation counter, not SCAN
Add `bumpGeneration()` / generation-aware keys to `IProductListCache`.
On any product write, the use case calls `bumpGeneration()`, which does
`INCR products:list:gen` in Redis. `ListProductsUseCase.buildCacheKey`
reads the current generation (cached in-process for a second or fetched)
and folds it into the key:
`products:list:v<gen>:<category>:<namePrefix>:<cursor>`. After a bump,
every pre-write key is unreachable; the orphaned entries expire via
their existing 45s TTL.

- **Why not `SCAN` + `DEL products:list:*`.** `SCAN` in a request path
  is O(keyspace), needs cursor iteration, and races with concurrent
  writes. `INCR` is O(1) and atomic.
- **Why not per-filter invalidation.** A write can affect any
  filter/page combination (a new product matches multiple prefixes; a
  category change moves a row between category buckets). Whole-namespace
  invalidation is the only correct option without modelling the query
  space. Cost: writes are rare relative to reads here, and a bump only
  forces cold reads to repopulate.
- **Fail-open preserved.** `bumpGeneration()` swallows Redis errors and
  logs, exactly like `get`/`set` today. If the bump fails, the write
  still succeeds and staleness falls back to the 45s TTL (covered by a
  spec scenario). If the generation *read* on the list path fails, the
  key falls back to `v0` (or generation is treated as absent) and the
  request still serves from DynamoDB.
- **Layering.** `create/update/delete` use cases gain a
  `PRODUCT_LIST_CACHE` constructor injection - same port that
  `ListProductsUseCase` already injects, no new infra import beyond the
  `@TraceSpan()` exception already in those files.

### `axios` instance mirrors the `ky` instance one-to-one
- `axios.create({ baseURL })` replaces `ky.create({ prefixUrl })`.
  `combineURLs` handles the missing leading slash, so service call sites
  (`'products'`, `'auth/login'`) are unchanged.
- Request interceptor sets `Authorization` from `getAccessToken()`.
- Response interceptor: on `error.response?.status === 401`, not the
  refresh URL, not already retried (`config._retry`), call
  `refreshSessionOnce()`; on success set the new bearer + `_retry` and
  re-issue via `axiosInstance(config)`; on failure clear session, call
  `onSessionExpired`, reject.
- `refreshSessionOnce` / `refreshSession` keep their exact single-flight
  shape; only the `ky.post(...).json()` call becomes
  `axios.post(...).then(r => r.data)`.
- `SignInPage`: `err instanceof HTTPError && err.response.status === 401`
  → `axios.isAxiosError(err) && err.response?.status === 401`.
- **Unit test rewrite.** `http-client.spec.ts` stubs global `fetch`;
  axios in jsdom uses `XMLHttpRequest`. The test is ported to
  `axios-mock-adapter` (dev dependency) preserving all four cases:
  retry-once-after-refresh, never-retry-refresh / no-loop-on-second-401,
  dedupe-concurrent-refresh, no-refresh-without-stored-token.

## Risks / Trade-offs

- **[Risk]** A controller handler added later without `@TraceRoot()`
  produces no trace, silently. → **Mitigation**: tasks add a checklist
  item and (if cheap) a unit test asserting every handler on each
  controller carries the decorator; documented as the accepted cost of
  reversing the global-interceptor decision.
- **[Risk]** `userId` extractor points at the wrong positional arg after
  a handler signature change, silently dropping user context. →
  **Mitigation**: keep the `@CurrentUser()` param first and the
  extractor uniform across handlers; assert `userId` on a span in an
  integration test for one protected route.
- **[Risk]** Generation counter key (`products:list:gen`) evicted or
  lost (Redis restart / maxmemory) resets to nil → treated as `v0`,
  which may collide with a stale pre-restart `v0` entry. →
  **Mitigation**: entries carry the 45s TTL, so any collision self-heals
  within one window; acceptable given the spec already permits bounded
  staleness between reads.
- **[Risk]** Extra `GET products:list:gen` on every list request adds a
  round-trip. → **Mitigation**: cache the generation in-process for a
  short interval (≤1s); a missed bump is bounded by that interval, well
  inside the tolerated window.
- **[Risk]** `axios` XHR vs `fetch` behavior differences (header casing,
  error shape) leak into callers. → **Mitigation**: the ported unit test
  plus the existing web e2e suite exercise the real 401/refresh/retry
  path end to end.

## Migration Plan

Purely internal - no endpoint, payload, table, or trace-format change.

- API: remove two dependencies, delete `tracing.interceptor.ts`, add
  `trace-root.decorator.ts`, edit `tracing-setup.ts` / `main.ts` /
  `infra.module.ts` / the three controllers / three product use cases /
  the cache adapter + port. `docker compose` (Jaeger) unchanged.
- Web: swap `ky`→`axios` in `package.json`, add `axios-mock-adapter`
  dev dep, edit `http-client.ts` + two services + `SignInPage` + one
  test.
- Rollback: revert the commit; nothing persisted changes. Orphaned
  `products:list:v*` keys expire within 45s on their own.
