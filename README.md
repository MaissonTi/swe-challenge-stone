# Stone Challenge — Authentication + Product Catalog (API + Web)

Authentication API (JWT RS256, with rotating refresh and revocation) and
a protected, paginated, filterable product catalog, with distributed
rate-limiting implemented in the application itself (not delegated to a
managed service) — plus a React SPA that consumes this API.

> The full rationale behind each architecture decision (why RS256, why
> a sliding window instead of a fixed window, why two separate
> DynamoDB tables, etc.) is in [`docs/PRD.md`](./docs/PRD.md). This
> README is about **how to run and test** the project.

## Stack

**API** (`apps/api`)

- **NestJS** + TypeScript
- **DynamoDB** (via LocalStack in dev) — user and product persistence
- **Redis** — rate-limit, revoked-token blacklist, listing cache
- **JWT RS256** (`@nestjs/jwt`) + **argon2id** (`argon2`) for passwords
- **Zod** (`nestjs-zod`) for validation, with schemas shared via
  `packages/common`
- **Jest** (unit, integration, and e2e) + **Swagger/OpenAPI**

**Web** (`apps/web`)

- **React** + **Vite** (SPA, no SSR) + **React Router** (data routers)
- **Tailwind** + **shadcn/ui** (Radix underneath)
- **React Query** (server state) + **react-hook-form** + Zod
  (forms, reusing `packages/common`'s schemas)
- **axios** for HTTP (`src/lib/http-client.ts`), with automatic
  refresh-and-retry and single-flight on `401`
- **Vitest** + **Testing Library** (unit/component) + **Playwright**
  (e2e against the real API)

**Shared**

- **Turborepo** (monorepo) + **Docker Compose** (local environment)
- `packages/common` — Zod schemas used by both the API's DTOs and the
  front-end's forms (the same validation rule on both sides)

## Architecture

`apps/api/src/` follows Clean Architecture in layers (not by business
module — see `docs/PRD.md`, §4.1.3, for why):

```text
domain/         → models, errors, and interfaces (ports). Zero framework dependency.
app/usecases/   → business logic, depends only on domain/ interfaces.
infra/          → concrete implementations: DynamoDB, Redis, JWT, argon2, HTTP guards.
presentation/   → controllers, DTOs (Zod), and HTTP presenters.
```

Every port in `domain/protocols/` has exactly one adapter in `infra/` —
that's what lets business logic be tested without a real database or
Redis (by mocking the interface).

## Prerequisites

- Node.js 20+ and npm
- Docker + Docker Compose (LocalStack + Redis + Jaeger)
- OpenSSL (to generate the RS256 key pair)

## Running locally

```bash
# 1. Install dependencies (monorepo root)
npm install

# 2. RS256 keys + .env (api and web) + docker compose up + tables + seed.
#    Idempotent - safe to run again at any time.
./scripts/setup.sh

# 3. Start API + front-end (http://localhost:3000 and http://localhost:5173)
npm run dev
```

Seed user: `demo@stone.com.br` / `Demo1234` (works both directly
against the API and through the front-end's sign-in screen).

- **Front-end**: <http://localhost:5173>
- **API**: business routes live under the `/v1` prefix
  (`http://localhost:3000/v1/auth/login`,
  `http://localhost:3000/v1/products`, …). `GET /health` stays unversioned.
- **Traces (Jaeger UI)**: <http://localhost:16686> — select the
  `swe-challenge-stone-api` service to see a request's trace (HTTP
  route → use case → DynamoDB/Redis)
- **Interactive docs (Swagger)**: <http://localhost:3000/docs>
  — the same OpenAPI document is versioned at
  [`apps/api/openapi.json`](./apps/api/openapi.json) (regenerate with
  `npm run generate:openapi --workspace=apps/api`)
- **Manual testing**: use Swagger itself (`/docs`, with "try it
  out") — covers every auth and product flow, including the expected
  error cases. To demo the rate-limit working live,
  see [`k6/README.md`](./k6/README.md).

## Tests

### API (`apps/api`)

Three layers, each with its own Jest config
(`apps/api/test/jest-*.json`):

| Command                                         | What it runs                                              | Needs the local stack? |
| ------------------------------------------------ | ---------------------------------------------------------- | ----------------------------- |
| `npm run test --workspace=apps/api`             | Unit — business rules and adapters with mocked dependencies | No                          |
| `npm run test:cov --workspace=apps/api`         | Unit + coverage report                                | No                          |
| `npm run test:integration --workspace=apps/api` | Repositories/adapters against **real** DynamoDB and Redis  | Yes (`docker compose up -d`) |
| `npm run test:e2e --workspace=apps/api`         | Real HTTP requests (supertest) against the whole application    | Yes                          |

```text
apps/api/
  src/            → production code, no tests here
  test/
    unit/         → mirrors src/, dependencies mocked via test/mocks/
    mocks/        → reusable mock factories for domain ports
    integration/  → against real Dynamo/Redis, no HTTP
    e2e/          → real HTTP (supertest) against the real stack
```

Current state: 120 unit tests + 11 integration + 21 e2e, ~82%
statement coverage in the unit report (the rest are DI composition
files — `*.module.ts`, `main.ts` — with no logic of their own, already
exercised by the e2e tests).

### Web (`apps/web`)

| Command                                 | What it runs                                              | Needs the local stack?                    |
| ---------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `npm run test --workspace=apps/web`     | Unit/component (Vitest + Testing Library)                   | No                                        |
| `npm run test:e2e --workspace=apps/web` | Playwright, real browser, against the real API (no HTTP mock) | Yes (`docker compose up -d` + API running) |

```text
apps/web/
  src/            → production code
  test/
    setup.ts      → jest-dom matchers + PointerEvent/ResizeObserver polyfills (jsdom)
    unit/         → mirrors src/, mocks services/providers via vi.mock
    e2e/          → Playwright, real browser, against the real API
```

8 unit/component tests + 5 e2e. The product form's category select
(Radix Select) isn't exercised in Vitest — opening/selecting via
pointer needs real `PointerEvent` behavior, which jsdom doesn't
reliably provide; that specific scenario ("invalid category blocked
client-side") is covered by Playwright, in a real browser, instead of
just being skipped.

> **About the listing cache in tests:** `GET /products` may serve a
> page up to 45s stale before a write (see `docs/PRD.md`, §4.4) — the
> front-end's e2e tests use a name filter unique per test (never
> queried before) instead of assuming the same query reflects the
> most recent write.

## Useful scripts

**`apps/api`**

| Script                         | Description                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run build`                | Production build (`nest build`)                                                           |
| `npm run dev`                  | Watch mode                                                                                 |
| `npm run lint`                 | ESLint over `src/` and `test/`                                                                 |
| `npm run generate:keys`        | Generates `keys/private.pem` + `keys/public.pem` (RS256)                                        |
| `npm run generate:openapi`     | Regenerates `apps/api/openapi.json` from the controllers (same document served at `/docs`, versioned) |
| `npm run bootstrap:localstack` | Creates the `Users`/`Products` tables in LocalStack                                           |
| `npm run seed`                 | Populates sample users and products                                                      |

**`apps/web`**

| Script                      | Description                                    |
| ---------------------------- | --------------------------------------------- |
| `npm run build`             | Production build (`tsc -b && vite build`)   |
| `npm run dev`               | Watch mode (Vite)                            |
| `npm run lint`              | ESLint over `src/` and `test/`                   |
| `npm run test` / `test:e2e` | Vitest / Playwright (see the Tests section above) |

## Cloud infrastructure (Terraform)

Persistence (the `Users`/`Products` DynamoDB tables + the API's IAM
access to them) is provisionable against real AWS via Terraform, in
[`terraform/`](./terraform/):

```bash
cd terraform
terraform init
terraform plan   # review what would be created
terraform apply  # provision against your AWS account
```

Not required to run the application locally (dev still uses
LocalStack/Docker Compose, section above) — see
[`terraform/README.md`](./terraform/README.md) for variables,
outputs, and the rationale behind each decision (why local state, why
this role has a neutral trust policy, etc.), and `docs/PRD.md` §4.10 for
why this item stopped being "out of scope."

## Deliberate scope decisions

This is an evaluation challenge, not a production system — avoiding
over-engineering here is as deliberate a decision as any technical
choice. The items below weren't built because they weren't worth it
for this scope, not because they weren't considered; in a real
architecture, especially a distributed one with multiple
microservices, several of these choices would likely be different.
Full rationale for each in [`docs/PRD.md`, §5](./docs/PRD.md):

- Production compute (ECS/Fargate/App Runner/Lambda) and networking
  (VPC, ALB) — where/how the API runs in production. **Persistence
  (DynamoDB tables + access IAM) is no longer on this list**: it's
  provisioned via Terraform in [`terraform/`](./terraform/) — see the
  section above.
- CI/CD
- Name search with `contains`/full-text (v1 uses a prefix)
- DAX (the Redis listing cache, with generation-counter invalidation,
  already covers the read pattern — see `docs/PRD.md`, §4.4)
- Refresh token in an `httpOnly` cookie (the front-end uses
  `localStorage` for now — trade-off documented in `docs/PRD.md`, §4.8)
- Admin-manageable user CRUD (the front-end only covers what the API
  exposes today)

## Decision and trade-off summary

Some decisions here were shaped by the constraints of _this specific
challenge_, not because they're the obvious choice in a real system.
Full list with the rationale behind each one in
[`docs/PRD.md`, §6](./docs/PRD.md):

- **DynamoDB for `Products`, not PostgreSQL** — a named requirement
  from the brief, not a free choice. It fits the catalog's current
  access pattern well (filter by category/prefix, no joins), but a
  real catalog with variants, prices, and related suppliers would tip
  the scale toward a relational database (ACID across entities).
- **Token revocation in this service's Redis**, not a central identity
  service (Cognito/Auth0/Keycloak) doing introspection — makes sense
  with a single service; stops scaling well once multiple services
  need to validate the same token.
- **Rate-limit built into the application**, not centralized in an
  API Gateway in front of several services — the same logic,
  reimplemented in each service, if this project grew beyond a single
  service.
- **No idempotency key on `POST /products`** — the real risk only
  shows up with automatic gateway/client retries in a distributed
  environment, which doesn't exist here.
- **RS256 keys as a local `keys/*.pem` file (gitignored), dev-only** —
  acceptable to sign/verify JWTs locally, but **not** for production:
  in production the key pair must come from **AWS Secrets Manager (or
  SSM Parameter Store)**, injected at runtime, never a file in the
  image or the repo. The PEM files are not versioned; regenerate them
  with `npm run generate:keys`. See [`docs/PRD.md`, §6](./docs/PRD.md).

## Additional documentation

- [`docs/PRD.md`](./docs/PRD.md) — architecture decisions, business rules, and trade-offs, with the rationale behind each one
- [`terraform/README.md`](./terraform/README.md) — how to provision the AWS infrastructure (DynamoDB tables + IAM), variables, and outputs
- [`docs/AI_USAGE_REPORT.md`](./docs/AI_USAGE_REPORT.md) — how AI was used in developing this project (methodology, developer decisions, bugs found through verification)
- `openspec/specs/` — current formal specs (`user-auth`, `products`, `rate-limit`, `web-spa`, `observability`, `cloud-infra`)
- `openspec/changes/archive/` — already-implemented, archived changes, with each one's original proposal/design
- `docs/diagrams/` — Markdown diagrams with Mermaid (render directly on GitHub/VS Code, no extra extension needed):
  - [`architecture-layers.md`](./docs/diagrams/architecture-layers.md) — the 4 layers (`domain/app/infra/presentation`) and the dependency direction
  - [`auth-flow.md`](./docs/diagrams/auth-flow.md) — register → login → refresh with rotation → reuse detection/cascading revocation → logout
  - [`dynamodb-model.md`](./docs/diagrams/dynamodb-model.md) — the `Users`/`Products` tables and the three GSIs
  - [`rate-limit-sliding-window.md`](./docs/diagrams/rate-limit-sliding-window.md) — the sliding-window counter calculation
  - [`deploy-topology-roadmap.md`](./docs/diagrams/deploy-topology-roadmap.md) — target deploy topology (compute + ElastiCache + networking, roadmap, not implemented — see `docs/PRD.md`, §7)
