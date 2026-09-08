## Why

An explore-mode review of the documentation against the shipped code
found the written material lagging the implementation in several places:
the generated OpenAPI document exposes no response schema for any route,
`README.md`/`FEAT.md` still describe the web app's HTTP client as `ky`
after it was migrated to `axios`, `key_words.md` predates the
generation-counter cache and still calls it a rejected alternative, and a
handful of claims (`iss` JWT claim, `Cache-Control`/`ETag` on
`GET /products`, a "50-100ms" fail-open timeout) describe behavior the
code does not implement. None of this changes what the system does — it
is a documentation-accuracy and API-documentation-quality gap that a
reviewer evaluating "professional-level documentation" would notice.

## What Changes

This is a refinement pass. It corrects documentation, improves the
generated OpenAPI document to professional quality, and moves the
business routes under a `/v1` path prefix. The only observable behavior
change is the route paths (`/auth/*` → `/v1/auth/*`,
`/products*` → `/v1/products*`); request/response bodies, status codes,
auth, rate-limit, cache and trace behavior are unchanged. No
requirement in `user-auth`, `products`, `rate-limit`, `web-spa`,
`observability`, or `cloud-infra` pins a literal path, so no spec delta
is needed (`.openspec.yaml` keeps `skip_specs: true`).

**API versioning (`/v1` prefix)**

- All business routes move under `/v1` via the segment on each
  controller (`@Controller('v1/auth')`, `@Controller('v1/products')`).
  `HealthController` stays `@Controller('health')` (liveness probes
  target a stable path) and the Swagger UI stays at `/docs`.
- The generated OpenAPI paths become `/v1/...` automatically (it is just
  the route path).
- `apps/web` HTTP layer points at `<base>/v1`; e2e request paths and
  `user.http` are updated; the `auth-flow` diagram's endpoint labels get
  the prefix.

**OpenAPI / Swagger (`apps/api`)**

- **Typed response schemas for every route.** Replace the response-DTO
  `type` aliases (`TokenResponseDto`, `ProfileResponseDto`,
  `ProductHttpDto`, `ListProductsResponseDto`) with introspectable
  shapes (`createZodDto` or classes with `@ApiProperty`) and annotate
  each handler with `@ApiOkResponse`/`@ApiCreatedResponse({ type })` plus
  a realistic example payload. Today the document carries request
  schemas (Zod) but zero response schemas.
- **Documented error shape.** Add a shared `ErrorResponseDto`
  (`statusCode`, `message`, `error`) with an example, referenced by the
  `4xx` responses.
- **Global `429` documentation.** The `RateLimitGuard` is global, so
  every route can return `429 Too Many Requests` + `Retry-After`.
  Document this once (global response + header) instead of ad hoc on two
  routes, and fill the per-route gaps (`401` on `DELETE`/`PATCH
  /products/:id`, `400`/`401` on `PATCH`, `429` on all product routes).
- **Richer `DocumentBuilder`.** Fuller description, `addServer`,
  per-tag descriptions, version sourced from `package.json`; add
  `type`/`example` to `@ApiParam('id')`; derive the `category`
  `@ApiQuery` enum from `productCategorySchema.options` instead of a
  hand-copied list.
- **Committed OpenAPI artifact.** Emit `openapi.json` during the build
  (script + npm task) and commit it, so the contract is reviewable
  without running the full stack.

**Documentation sync (`README.md`, `FEAT.md`, `key_words.md`, `docs/USO_DE_IA.md`, `.env.example`)**

- **`ky` → `axios`.** Update `README.md` "Stack" and `FEAT.md` §4/§12 to
  match the shipped `apps/web/src/lib/http-client.ts` (`axios`), and fix
  the `lib/http-service` path reference to `lib/http-client`.
- **`key_words.md` post-refine.** Rewrite the "DAX/counter", "Cheap-
  operation stampede", "Stale-while-revalidate" and "Where this showed up"
  sections so the generation counter is described as adopted (per
  `FEAT.md` §6 and `redis-product-list-cache.ts`), not rejected; correct
  the "30-60s" TTL prose to 45s.
- **JWT claims.** `FEAT.md` §8 lists `iss` and a separate `user_id`
  claim that `jwt-encrypter.ts` does not emit. Correct the list to the
  actual claims (`sub`, `jti`, `familyId`, `type`, `iat`, `exp`);
  decision on whether to *add* `iss` is deferred to a future change and
  noted as such.
- **Fail-open wording.** `FEAT.md` §5 and `key_words.md` state a
  "50-100ms" per-operation timeout that the adapters do not implement
  (they catch the Redis failure and proceed). Soften the wording to
  describe the actual mechanism; a real bounded timeout is left as a
  documented future improvement.
- **`Cache-Control`/`ETag` claim.** `FEAT.md` §6 says these are kept on
  `GET /products`; no header is set. Remove the claim and record
  client/CDN cache headers as a documented future improvement.
- **`list-products.usecase.ts` comment.** "janela de 30-60s" → 45s, to
  match `FEAT.md` §6.
- **Test counts.** Reconcile `README.md` (unit "96") and
  `docs/USO_DE_IA.md` (summary "90/11/14") with the current counts, or
  mark the historical figures explicitly as point-in-time.
- **`.env.example`.** Add `OTEL_EXPORTER_OTLP_ENDPOINT` (declared in
  `env.ts` but absent from the example); fix the dangling
  `see keys/README.md` reference (no such file) to point at
  `npm run generate:keys`.

**Diagrams (`docs/diagrams/`, `user.http`)**

- **`dynamodb-model.excalidraw`.** Add the `Users` table's `byUserId`
  GSI — present in `users.table.ts`, `bootstrap-localstack.ts`,
  `terraform/`, `FEAT.md` §11 and `key_words.md`, but missing from the
  diagram (which does show both `Products` GSIs).
- **`docs/USO_DE_IA.md` diagram count.** "one of the four" / "the other
  three" → five diagrams (`deploy-topology-roadmap` was added with the
  Terraform change).
- **`user.http`.** Add the missing `###` separator before `# @name me`
  so the REST Client treats `GET /auth/me` as its own request.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change is documentation, generated-API-doc quality, and
tooling only; no spec-level behavior changes. `.openspec.yaml` sets
`skip_specs: true`.

## Impact

- **API code (doc annotations + tooling):**
  `apps/api/src/infra/swagger/swagger.config.ts`,
  `apps/api/src/presentation/http/dtos/**`,
  `apps/api/src/presentation/http/presenters/product.presenter.ts`,
  `apps/api/src/presentation/http/controllers/*.controller.ts`,
  `apps/api/src/app/usecases/products/list-products.usecase.ts` (comment),
  a new `apps/api/scripts/generate-openapi.ts` + `package.json` script,
  a committed `apps/api/openapi.json`.
- **API code (`/v1` prefix):**
  `apps/api/src/presentation/http/controllers/{auth,products}.controller.ts`
  (`@Controller('v1/...')`), `apps/api/test/e2e/*.e2e-spec.ts`
  (request paths).
- **Web code (`/v1` prefix):** `apps/web/src/lib/http-client.ts`.
- **Docs:** `README.md`, `FEAT.md`, `key_words.md`,
  `docs/USO_DE_IA.md`, `apps/api/.env.example`,
  `docs/diagrams/dynamodb-model.excalidraw`,
  `docs/diagrams/auth-flow.excalidraw`, `user.http`.
- **Observable change:** route paths only (`/auth/*` → `/v1/auth/*`,
  `/products*` → `/v1/products*`; `GET /health` unchanged). Payloads,
  status codes, JWT contents, rate-limit/cache/trace behavior,
  Terraform resources and `packages/common` schemas are unchanged.
- **Dependencies:** none added (all `@nestjs/swagger` and
  `@nestjs/common` primitives are already installed).
