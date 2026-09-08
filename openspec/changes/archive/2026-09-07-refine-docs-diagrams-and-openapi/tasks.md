## 1. OpenAPI — response schemas & examples

- [x] 1.1 Define response schemas for auth: `tokenResponseSchema`
      (`accessToken`, `refreshToken`) and `profileResponseSchema`
      (`userId`, `email`, `createdAt`) next to their DTOs; export
      `createZodDto`-based classes replacing the current `type` aliases.
- [x] 1.2 Define `productHttpSchema` (`id`, `name`, `category`, `active`,
      `createdAt`, `updatedAt`) and `listProductsResponseSchema`
      (`items`, optional `nextCursor`) next to `product.presenter.ts` /
      the products response DTO; replace the `type` aliases.
- [x] 1.3 Add a unit assertion that `ProductPresenter.toHTTP(...)` output
      parses against `productHttpSchema` (keeps presenter and schema in
      sync).
- [x] 1.4 Annotate every controller handler with
      `@ApiOkResponse`/`@ApiCreatedResponse`/`@ApiNoContentResponse({ type })`
      and a realistic `example` (replace the `'<jwt>'` placeholders on
      `login`/`refresh` with clearly-fake JWT-shaped strings).
- [x] 1.5 Add `@ApiParam('id', { type: String, format: 'uuid', example })`
      on the product `:id` routes.
- [x] 1.6 Derive the `category` `@ApiQuery` enum from
      `productCategorySchema.options` instead of the hand-copied array.

## 2. OpenAPI — errors, 429, DocumentBuilder

- [x] 2.1 Add a shared `ErrorResponseDto` (`statusCode`, `message`,
      `error`) with an example; reference it from the `4xx`
      `@ApiResponse` entries.
- [x] 2.2 Fill per-route non-429 gaps: `401` on `DELETE /products/:id`
      and `PATCH /products/:id`; `400` on `PATCH /products/:id`.
- [x] 2.3 Document `429 Too Many Requests` + `Retry-After` once as a
      global response (`DocumentBuilder`/`@ApiResponse` on the base
      document or a shared decorator); keep an explicit per-route `429`
      note only where the limit differs from the default (`register`,
      `login`).
- [x] 2.4 Enrich `swagger.config.ts`: fuller `setDescription`, add
      `addServer('http://localhost:3000')`, per-tag descriptions,
      `setVersion` sourced from `apps/api/package.json`.
- [x] 2.5 Fix colliding `operationId`s: `@TraceRoot()` replaced each
      handler with an anonymous wrapper (`fn.name === ''`), so
      `@nestjs/swagger` emitted `AuthController_` / `ProductsController_`
      for every route — making Swagger UI expand/collapse them together.
      Preserve the method name on the wrapper in
      `trace-root.decorator.ts`.

## 3. OpenAPI — committed artifact

- [x] 3.1 Add `apps/api/scripts/generate-openapi.ts` — boot Nest in
      document-only mode (no `listen`), `SwaggerModule.createDocument`,
      write `apps/api/openapi.json` (pretty-printed, stable key order).
- [x] 3.2 Add `"generate:openapi"` to `apps/api/package.json` scripts;
      mention it in `README.md` "Useful scripts" and the docs list.
- [x] 3.3 Generate and commit `apps/api/openapi.json`; add it to any
      relevant lint/format ignore if needed.

## 4. Documentation sync — prose

- [x] 4.1 `README.md` "Stack": `ky` → `axios`; verify the "automatic
      refresh-and-retry on 401" wording still matches `http-client.ts`.
- [x] 4.2 `FEAT.md` §4 table row and §12: `ky` → `axios`; fix
      `lib/http-service` → `lib/http-client`.
- [x] 4.3 `docs/USO_DE_IA.md` "Front-end" section: `lib/http-service` →
      `lib/http-client`, `ky` → `axios` where it describes the shipped
      state (leave the historical "migrate from ky to axios" narrative).
- [x] 4.4 `FEAT.md` §8: correct the JWT claims list to the emitted set
      (`sub`, `jti`, `familyId`, `type`, `iat`, `exp`); drop `iss` and
      the separate `user_id`; add a one-line "future improvement" note if
      adding `iss` is still wanted.
- [x] 4.5 `FEAT.md` §5 and `key_words.md` "Fail-open": replace the
      "short timeout (50-100ms)" claim with a description of the actual
      catch-and-proceed behavior; record a bounded per-op timeout as a
      documented future improvement.
- [x] 4.6 `FEAT.md` §6: remove the "`Cache-Control` + `ETag` are kept on
      `GET /products`" claim; record client/CDN cache headers as a future
      improvement.
- [x] 4.7 `apps/api/src/app/usecases/products/list-products.usecase.ts`:
      fix the `CACHE_TTL_SECONDS` comment ("30-60s window" → 45s).
- [x] 4.8 `key_words.md`: rewrite "DAX/counter", "Cheap-operation
      stampede", "Stale-while-revalidate", and "Where this showed up" so the
      generation counter is described as adopted (ref `FEAT.md` §6 +
      `redis-product-list-cache.ts`), not rejected; TTL prose "30-60s" →
      45s.

## 5. Documentation sync — counts & config

- [x] 5.1 Recount API tests (`npm run test`, `test:integration`,
      `test:e2e`) and web tests; update `README.md` ("96 + 11 + 16") and
      the `docs/USO_DE_IA.md` summary ("90 / 11 / 14") to the real
      numbers, or mark the historical figures as point-in-time per phase.
- [x] 5.2 `apps/api/.env.example`: add `OTEL_EXPORTER_OTLP_ENDPOINT`
      (matching `env.ts` default `http://localhost:4318`) with a short
      comment.
- [x] 5.3 `apps/api/.env.example`: replace the dangling
      `see keys/README.md` with `run: npm run generate:keys` (or create a
      brief `apps/api/keys/README.md` if a file is preferred — pick one).

## 6. Diagrams & user.http

- [x] 6.1 `docs/diagrams/dynamodb-model.excalidraw`: add the `Users`
      `byUserId` GSI (PK `userId`, projection ALL), matching the two
      `Products` GSI boxes' style; keep bound text and arrow bindings
      consistent with the existing elements.
- [x] 6.2 `docs/USO_DE_IA.md` "Documentation and diagrams": "one of the
      four" / "the other three" → five diagrams; name `deploy-topology-roadmap`
      as added with the Terraform change.
- [x] 6.3 `user.http`: add the missing `###` separator immediately before
      `# @name me`.
- [x] 6.4 Skim the other four diagrams (`architecture-layers`,
      `auth-flow`, `rate-limit-sliding-window`,
      `deploy-topology-roadmap`) for any label that drifted; note or fix.

## 7. API versioning — `/v1` prefix

- [x] 7.1 Put the `/v1` segment on the controllers:
      `@Controller('v1/auth')`, `@Controller('v1/products')`.
      `HealthController` stays `@Controller('health')` (unversioned).
- [x] 7.2 e2e app factory needs no prefix wiring (it is on the
      controllers); leave `create-test-app.ts` as-is apart from its
      doc comment.
- [x] 7.3 `apps/api/test/e2e/auth.e2e-spec.ts` and `products.e2e-spec.ts`:
      prefix every request path with `/v1` (leave `/health` if present).
- [x] 7.4 `apps/web/src/lib/http-client.ts`: point the axios instance
      `baseURL` and the bare refresh `axios.post` at `<API_BASE_URL>/v1`
      (service modules keep their relative paths).
- [x] 7.5 `user.http`: add a `@v1 = {{baseUrl}}/v1` variable and use it
      for the auth/products requests; keep `/health` on `{{baseUrl}}`.
- [x] 7.6 `docs/diagrams/auth-flow.excalidraw`: prefix the endpoint
      labels (`POST /v1/auth/register`, `/v1/auth/login`, etc.).
- [x] 7.7 `README.md` / `FEAT.md`: note that business routes are served
      under `/v1` (health stays unversioned); fix any literal path shown
      as a contract.
- [x] 7.8 Regenerate `apps/api/openapi.json`; confirm paths are now
      `/v1/...` (and `/health` unchanged).

## 8. Verify

- [x] 8.1 `npm run lint` and `npm run test` (unit) for `apps/api` pass.
- [x] 8.2 Boot the API, open `/docs`: every route shows a response body
      schema + example; `429`/`Retry-After` visible; error shape shown;
      paths carry `/v1` and `/health` does not.
- [x] 8.3 Re-run `npm run generate:openapi`; confirm the committed
      `apps/api/openapi.json` has no further diff.
- [x] 8.4 `apps/web`: `npm run lint` and `npm run test` pass.
- [x] 8.5 `openspec validate refine-docs-diagrams-and-openapi --strict`
      passes.
