## Why

The tracing layer carries machinery that a review flagged as avoidable:
HTTP auto-instrumentation forces a fragile import-order constraint in
`main.ts`, and the `observability/` folder still holds unused code
inherited from the source kit. Separately, creating or deleting a
product through the web app does not show up in the listing for up to
45s, because the product-list read cache is never invalidated on write —
the SPA already refetches correctly, but the API keeps serving the stale
page. The web app also uses `ky`, and the team wants `axios`.

## What Changes

- **Tracing root span moves to an explicit per-handler decorator.**
  Remove `@opentelemetry/instrumentation-http` (`HttpInstrumentation`)
  from `tracing-setup.ts` and the global `APP_INTERCEPTOR`
  `TracingInterceptor`. Introduce a `@TraceRoot()` method decorator
  applied directly to every HTTP controller handler; it opens the root
  span and stamps `userId` baggage (read from the request). This
  reverses the `add-tracing-observability` design decision "Root span:
  global NestInterceptor, not a per-controller decorator" — recorded in
  this change's design.md.
- **Import-order constraint in `main.ts` is dropped.** With no
  `require()` monkey-patching, `tracing-setup` no longer has to be the
  very first import; `dotenv/config` becomes an explicit import again.
- **Dead observability code removed:** `TraceReturnType` (exported,
  unreferenced), the unused `name` option and `| string` prefix union
  on `@TraceSpan()`, and the now-unused `@opentelemetry/instrumentation`
  / `@opentelemetry/instrumentation-http` dependencies.
- **Product-list cache is invalidated on every write.** Create, update,
  and delete product use cases invalidate cached listings via a
  generation counter (`INCR` on write; the counter value is folded into
  the cache key), so a subsequent list reflects the write immediately.
  The bounded-staleness window now applies only between reads with no
  intervening write.
- **Web app HTTP client migrates from `ky` to `axios`.** `http-client.ts`
  (auth header + single-flight 401 refresh/retry), both service modules,
  the `SignInPage` `HTTPError` check, and the `http-client` unit test
  are ported; `ky` is replaced by `axios` in `package.json`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `products`: the "Read-Path Caching" requirement changes — a write
  (create, update/deactivate, delete) SHALL invalidate cached listings
  so the next listing read reflects that write, rather than tolerating
  staleness after writes.

## Impact

- **API code:** `apps/api/src/infra/observability/` (all files),
  `apps/api/src/main.ts`, `apps/api/src/infra/infra.module.ts`,
  `apps/api/src/presentation/http/controllers/*.controller.ts`,
  `apps/api/src/app/usecases/products/{create,update,delete}-product.usecase.ts`,
  `apps/api/src/infra/cache/redis-product-list-cache.ts`,
  `apps/api/src/domain/protocols/cache/product-list-cache.interface.ts`.
- **API dependencies:** drop `@opentelemetry/instrumentation`,
  `@opentelemetry/instrumentation-http`.
- **Web code:** `apps/web/src/lib/http-client.ts`,
  `apps/web/src/services/{auth,products}.service.ts`,
  `apps/web/src/routes/auth/SignInPage.tsx`,
  `apps/web/test/unit/lib/http-client.spec.ts`.
- **Web dependencies:** replace `ky` with `axios`.
- **No API contract change:** endpoints, payloads, and the trace export
  format are unchanged; traces still show HTTP entry → use case →
  data-store spans.
