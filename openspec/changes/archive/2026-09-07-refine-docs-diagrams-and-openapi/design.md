## Context

See proposal.md — Why. The gap is entirely between what the docs say and
what the code does; the code is the source of truth for this pass. Two
items are genuine "the doc describes something better than what's built"
cases (`Cache-Control`/`ETag` on `GET /products`, a bounded fail-open
timeout) and need a deliberate call rather than a mechanical edit.

The OpenAPI document is generated at runtime by `@nestjs/swagger` +
`nestjs-zod`'s `patchNestJsSwagger()`. Request bodies already produce
schemas because the request DTOs extend `createZodDto(...)`. Response
DTOs are bare TypeScript `type` aliases, which are erased at runtime, so
`@nestjs/swagger` has nothing to introspect and emits no response
schema.

## Goals / Non-Goals

**Goals:**

- Every documented route in `/docs` (and the committed `openapi.json`)
  carries a typed response body and a realistic example.
- The prose docs, diagrams, and `user.http` describe the system as it is
  actually built and configured.
- The OpenAPI contract is reviewable as a committed artifact, not only
  as a running endpoint.

**Non-Goals:**

- Changing any status code, payload field, JWT claim, header, or
  rate-limit/cache behavior. The `/v1` prefix moves route paths but
  nothing else; there is no second API version.
- Implementing `Cache-Control`/`ETag` or a per-operation Redis timeout —
  both are recorded as documented future improvements, not built here.
- Reworking the specs under `openspec/specs/` — they were checked and
  match the implementation (`skip_specs: true`).
- Translating the OpenSpec artifacts or the English endpoint
  descriptions; the repo keeps OpenSpec artifacts in English.

## Decisions

### Response schemas via `createZodDto`, not hand-written `@ApiProperty` classes

The request side already defines its shapes in `packages/common` Zod
schemas. For responses there is no shared schema today. Two options:

- **A (chosen): define response Zod schemas and wrap with
  `createZodDto`.** Consistent with the request side, single definition
  drives both the TS type and the OpenAPI schema, and `patchNestJsSwagger`
  already handles it. Response schemas that mirror a domain shape
  (`ProductHttpDto`) live next to the presenter; token/profile response
  schemas live with their DTOs.
- B: plain classes with `@ApiProperty` decorators. More `@nestjs/swagger`
  idiomatic but introduces a second schema style in the same codebase
  and a hand-maintained parallel to the presenter output.

Example payloads are attached with `@ApiOkResponse({ type, example })` /
`schema.example`; the login/refresh `'<jwt>'` placeholders are replaced
with realistic (clearly fake) JWT-shaped strings.

### `429` documented globally, not per route

`RateLimitGuard` is an `APP_GUARD`, so 429 is reachable on every route.
Rather than sprinkle `@ApiResponse({ status: 429 })` on ~10 handlers and
still miss some, document it once — a global response plus the
`Retry-After` header — and keep an explicit `@ApiResponse` only where the
limit differs from the default (`register` 10/min, `login` 5/min) so the
per-route number is still visible. Remaining per-route gaps that are not
about 429 (`401` on `DELETE`/`PATCH /products/:id`, `400`/`401` on
`PATCH`) are filled directly.

### Commit a generated `openapi.json`

A new `apps/api/scripts/generate-openapi.ts` boots the Nest app in
document-only mode (no `listen`), calls `SwaggerModule.createDocument`,
and writes `apps/api/openapi.json`. Wired as `npm run generate:openapi`.
The file is committed so the contract diffs in review; keeping it current
is a task/CI concern noted in tasks.md, not enforced by a hook in this
change.

### Prose fixes track the code, and unbuilt claims become "future improvement"

For `iss`, `Cache-Control`/`ETag`, and the "50-100ms" timeout, the doc
currently over-promises. This pass makes the docs true by describing what
exists and moving the nicer-but-unbuilt behavior into an explicit
"future improvement" note (same register `FEAT.md` already uses for DAX,
`httpOnly` cookies, etc.). Implementing any of them is a separate
behavior change with its own spec delta.

### `/v1` as a segment on each `@Controller()`

`@Controller('v1/auth')` and `@Controller('v1/products')`;
`HealthController` stays `@Controller('health')` (unversioned — liveness
probes target a fixed path). Alternatives considered:

- **`app.setGlobalPrefix('v1', { exclude: ['health'] })` in `main.ts`**
  — one line, but the prefix then lives away from where the route is
  declared, and it needs a bootstrap helper shared by `main.ts`, the
  `generate-openapi` script and the e2e app factory to stay consistent.
  Rejected: with three controllers the extra indirection costs more than
  it saves.
- **`app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`**
  — the idiomatic NestJS mechanism, but it adds per-controller
  `version`/`VERSION_NEUTRAL` bookkeeping and a `v1` literal that reads
  as `1`. Overkill when there is exactly one version and no plan to run
  two side by side.

The segment on `@Controller()` is picked up by
`SwaggerModule.createDocument` like any route path (so `openapi.json`
paths are `/v1/...` with no extra config), and the Swagger UI mount
(`/docs`) is unaffected since it is not part of the router.

The web app concentrates the prefix in one place —
`http-client.ts` sets the axios instance `baseURL` (and the bare refresh
call) to `<VITE_API_BASE_URL>/v1` — so the service modules keep their
relative paths unchanged. e2e specs and `user.http` get the prefix on
each request line.

### `@TraceRoot()` must preserve the handler's function name

Generating the OpenAPI doc surfaced a latent bug: `@TraceRoot()`
(on every controller handler) reassigns `descriptor.value` to an
anonymous `async function`, whose `.name` is `''`.
`@nestjs/swagger` builds `operationId` as `${ControllerName}_${fn.name}`,
so every route collapsed to `AuthController_` / `ProductsController_` —
duplicate ids that Swagger UI keys its expand/collapse DOM state on, so
opening one operation opened all siblings. Fix: `Object.defineProperty`
the wrapper's `name` back to the property key inside the decorator. This
is the tracing decorator, not the OpenAPI layer, but the defect is only
observable through the generated document, so it belongs here.

### `key_words.md` is edited in place, not regenerated

It predates `refine-observability-and-web-fixes`. Only the four
cache-related sections are stale; the DynamoDB/GSI/fail-open sections are
still accurate. Edit those four sections rather than rewrite the file, to
keep the diff reviewable.

## Risks / Trade-offs

- **Committed `openapi.json` drifts from the annotations.** → Add a
  `generate:openapi` task and a tasks.md item to run it as the last step;
  note CI enforcement as a follow-up (out of scope here, like the rest of
  CI/CD per `FEAT.md` §10).
- **Response Zod schemas duplicate the presenter shape.** → Acceptable:
  the presenter maps domain→HTTP, the schema documents the HTTP shape;
  one unit assertion that `ProductPresenter.toHTTP` output parses against
  the response schema keeps them honed.
- **Softening the `ETag`/timeout claims could read as removing a
  feature.** → The proposal and the "future improvement" notes make
  explicit that the behavior was never implemented, so nothing is lost —
  the docs stop describing a thing that isn't there.
- **Someone re-adds `ky` wording from muscle memory.** → Low impact; the
  committed `openapi.json` and the `http-client.ts` filename are the
  durable source of truth.
