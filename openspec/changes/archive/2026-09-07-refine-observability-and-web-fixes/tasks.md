## 1. Tracing: `@TraceRoot()` decorator replaces the interceptor

- [x] 1.1 Add `trace-root.decorator.ts` in `apps/api/src/infra/observability/`:
      a `@TraceRoot(userIdFrom?: (args: unknown[]) => string | undefined)`
      method decorator that opens the root span via
      `new Trace(spanName).spanRoot({ userId })`, runs the original method
      inside `context.with(span.context(), ...)`, records exceptions, and
      finishes the span. Span name: `${target.constructor.name}.${propertyKey}`.
- [x] 1.2 Apply `@TraceRoot()` to every handler in `products.controller.ts`
      (`create`, `list`, `update`, `delete`). These use `@Body()`/`@Param()`/
      `@Query()` and have no `@CurrentUser()` param today - pass no extractor
      (userId still lands on child spans is not required here; root carries
      it only where available). If a `@CurrentUser()` param is added later,
      wire the extractor then.
- [x] 1.3 Apply `@TraceRoot()` to every handler in `auth.controller.ts`:
      `register`, `login`, `refresh` (public, no extractor); `logout` and
      `me` pass `args => (args[0] as VerifiedTokenPayload)?.sub` (the
      `@CurrentUser()` param is positional arg 0 in both).
- [x] 1.4 Apply `@TraceRoot()` to `health.controller.ts` `check` handler
      (public, no extractor).
- [x] 1.5 Delete `tracing.interceptor.ts` and remove its `APP_INTERCEPTOR`
      provider + import from `infra.module.ts`.
- [x] 1.6 Integration check: hit one protected route (e.g. `GET /auth/me`)
      against local Jaeger and confirm a root span exists named
      `AuthController.me` with the `user.id` attribute set; hit `GET /health`
      and confirm its root span has no `user.id`. — verified against the
      real running stack: `AuthController.me` root span carries
      `user.id` (matching the authenticated user's real id);
      `HealthController.check` root span carries no `user.id`.

## 2. Tracing: drop HTTP auto-instrumentation

- [x] 2.1 In `tracing-setup.ts` remove the `HttpInstrumentation` import and
      the `instrumentations: [...]` entry; set `instrumentations: []` on the
      `NodeSDK` config. Keep the OTLP exporter, resource attributes,
      `BatchSpanProcessor`, and SIGTERM handler unchanged.
- [x] 2.2 In `main.ts` move `import './infra/observability/tracing-setup'`
      out of the mandatory-first position and re-add an explicit
      `import 'dotenv/config'`; update/remove the now-stale import-order
      comment block.
- [x] 2.3 Remove `@opentelemetry/instrumentation` and
      `@opentelemetry/instrumentation-http` from `apps/api/package.json`;
      run install; confirm build + full api test suite pass.

## 3. Observability dead-code cleanup

- [x] 3.1 Delete `TraceReturnType` from `trace-span.interface.ts`.
- [x] 3.2 In `trace.decorator.ts` remove the `name` field from
      `TraceSpanOptions`, drop the `options?.name ?? ...` branch (always use
      `${target.constructor.name}.${String(propertyKey)}`), and narrow
      `prefix` to `TracePrefixEnum` only (remove `| string` in the type and
      in `buildSpanName`).
- [x] 3.3 Confirm no remaining references to removed symbols
      (`grep -r TraceReturnType apps/api/src` etc.) and that api build +
      tests are green.

## 4. Product-list cache invalidation on write

- [x] 4.1 Extend `IProductListCache`
      (`domain/protocols/cache/product-list-cache.interface.ts`) with
      `getGeneration(): Promise<number>` and
      `bumpGeneration(): Promise<void>`; document the fail-open contract
      (errors swallowed, generation read falls back to 0).
- [x] 4.2 Implement both in `redis-product-list-cache.ts`: `bumpGeneration`
      does `INCR products:list:gen`; `getGeneration` does
      `GET products:list:gen` (parse or 0), with a short in-process TTL
      cache (<=1s) to avoid a round-trip per list request. Wrap both in the
      same try/catch + `logger.warn` pattern as `get`/`set`.
      Decorate both with `@TraceSpan({ prefix: TracePrefixEnum.Cache })`.
- [x] 4.3 In `list-products.usecase.ts` `buildCacheKey`, fold the current
      generation into the key:
      `products:list:v<gen>:<category>:<namePrefix>:<cursor>`. Fetch the
      generation before building the key.
- [x] 4.4 Inject `PRODUCT_LIST_CACHE` into `CreateProductUseCase`,
      `UpdateProductUseCase`, and `DeleteProductUseCase`; call
      `bumpGeneration()` after the repository write succeeds. A failed bump
      must not fail the use case.
- [x] 4.5 Register the updated constructor deps in `usecases.module.ts` if
      wiring is explicit there.
- [x] 4.6 Tests: unit-test each write use case bumps the generation on
      success and still resolves when the bump throws; unit-test
      `ListProductsUseCase` uses a generation-scoped key and misses the
      pre-bump cache entry after a bump.
- [x] 4.7 Update the web e2e note in `product-lifecycle.spec.ts` (and any
      `specs/products` cross-reference in its header comment) now that a
      write is immediately visible - the distinct-prefix workaround can be
      simplified or removed; keep the suite green.

## 5. Web HTTP client: `ky` -> `axios`

- [x] 5.1 In `apps/web/package.json` replace `ky` with `axios`; add
      `axios-mock-adapter` to `devDependencies`; install.
- [x] 5.2 Rewrite `apps/web/src/lib/http-client.ts` on `axios.create({ baseURL })`:
      request interceptor for the bearer token; response interceptor for
      401 -> `refreshSessionOnce()` -> retry once (`config._retry` guard,
      skip for the `/auth/refresh` URL) -> on refresh failure clear session
      + `onSessionExpired()`. Keep `refreshSessionOnce` / `refreshSession`
      single-flight logic identical; only the HTTP call changes to
      `axios.post(...).then(r => r.data)`.
- [x] 5.3 Update `services/auth.service.ts` and `services/products.service.ts`:
      `.json<T>()` -> `.then(r => r.data)`, `{ json }` -> body arg,
      `{ searchParams }` -> `{ params }`. Call-site paths stay unchanged.
- [x] 5.4 In `routes/auth/SignInPage.tsx` replace
      `import { HTTPError } from 'ky'` + `err instanceof HTTPError && err.response.status === 401`
      with `axios.isAxiosError(err) && err.response?.status === 401`.
- [x] 5.5 Port `test/unit/lib/http-client.spec.ts` to `axios-mock-adapter`,
      preserving all four cases: retry-once-after-successful-refresh;
      never-retry-refresh-and-no-loop-on-second-401;
      dedupe-concurrent-refresh-into-one-call; no-refresh-without-stored-token.
- [x] 5.6 Run `apps/web` lint + unit tests + the Playwright e2e suite;
      confirm sign-in, 401 refresh/retry, and product create/delete
      visibility all pass. — verified: lint clean (0 errors, 3
      pre-existing warnings), 8/8 unit tests, 5/5 Playwright e2e
      (session sign-in/redirect/sign-out, product create+deactivate and
      create+delete visibility in the listing).

## 6. Docs

- [x] 6.1 Update `FEAT.md` / `docs/USO_DE_IA.md` (and any tracing notes)
      where they describe the global `TracingInterceptor` or
      `HttpInstrumentation`, to reflect the `@TraceRoot()` per-handler
      approach and cache-invalidation-on-write behavior.
