# PRD — Stone Challenge: Authentication + Product Catalog (API + Web)

> Product Requirements Document for this technical challenge.
> Consolidates requirements, architecture decisions, and trade-offs —
> used as input for the formal specs in OpenSpec (`openspec/specs/`);
> it is not the spec itself.

## 1. Overview / Problem

The challenge asks for a user-authentication API and a protected
product-listing route, robust enough to "handle a significant volume
of requests" — which already pulls rate-limiting and pagination in as
first-class requirements, not just CRUD with login in front of it.

What was built: the requested authentication API and paginated product
listing, with distributed rate-limiting; an SPA front-end consuming
that API; observability via distributed tracing; and persistence
infrastructure (DynamoDB + IAM) provisioned via Terraform against real
AWS. Production compute (where/how the API runs) remains a deferred
decision — see §5.

## 2. Goals & Non-Goals

**Goals (functional requirements):**

- Secure user login
- A protected (authentication-required) product-listing route
- Paginated listing
- A rate-limit mechanism for high request volume

**Non-Goals:** a series of decisions deliberately out of scope for
this delivery (production compute, CI/CD, full-text search,
roles/permissions, and more) — see §5 for the full list with each
one's rationale, and §6 for what would change if this were a real
production system.

## 3. Requirements

### Functional requirements

- Secure user login
- A protected (authentication-required) product-listing route
- Paginated listing
- A rate-limit mechanism for high request volume

### Mandatory technical requirements

- NodeJS + TypeScript
- Authentication via JWT
- Persistence in **DynamoDB (AWS)** — mandatory (overrides the
  brief's generic list of databases, which also mentions
  MongoDB/MySQL/PostgreSQL)
- Infrastructure via **Terraform**
- Unit tests with comprehensive coverage
- Project documentation (OpenAPI, flowcharts, etc.)
- Structured, documented AI usage, if any

### Evaluation criteria

1. Efficient logic
2. Structured code organization
3. Market standards / efficient architecture
4. Unit tests (skill + coverage)
5. Project documentation
6. Understanding and use of cloud infrastructure (AWS)
7. Structured AI usage (if applicable)

## 4. Architecture and Key Decisions

### Decision summary (quick read)

> A simple view of what's already been decided. The whys and technical
> details for each point are in the subsections below and the
> trade-off table that follows.

**Authentication**

- Login with e-mail/password. Password: at least 8 characters,
  uppercase, lowercase, a number, and no whitespace.
- Access token (JWT) lasts 15 minutes. Refresh token lasts 7 days and
  renews itself on every use, as long as the user stays active.
- Logout and token revocation work via a "blacklist" kept in Redis.
- If an old (already-used) refresh token shows up again, that's a
  theft signal — every token from that login is revoked at once (the
  same pattern used by Google and Auth0).
- There are no roles/permissions (admin, etc.) — every authenticated
  user has the same access level.
- Login/registration never reveal whether an e-mail exists in the
  database, to make user-enumeration attacks harder.

**Products**

- Full CRUD: create, edit, list, and delete.
- Deleting doesn't remove it from the database, it just marks it
  inactive. The listing only shows active products.
- Filterable by name and category. Category is a closed set of values
  (enum), not free text.
- Paginated listing, always sorted by the same criterion (stable).
- No "multi-tenant" - it's a single, global catalog.

**Rate-limit**

- Implemented in the application itself, using Redis — not delegated
  to AWS WAF.
- Copies the logic of a WAF rule (a continuous time window, not a
  counter that resets abruptly), but is more precise: it limits per
  logged-in user, not just per IP.
- When the limit is exceeded, the API responds `429` and reports how
  long to wait.

**Cache**

- The same Redis also caches the product listing, to protect DynamoDB
  from repeated reads.

**Resilience**

- If Redis goes down, the API doesn't stop working: rate-limit and
  token revocation temporarily "relax" (fail-open) instead of taking
  everything down. Authentication itself (token signature) keeps
  working even without Redis.

**Infrastructure**

- Everything runs in a single service (not microservices) — splitting
  it up today isn't worth it.
- Main database: DynamoDB. Cache, rate-limit, and blacklist: Redis.
- Local environment runs on Docker Compose + LocalStack.
- Persistence (DynamoDB tables + access IAM) provisioned via Terraform
  against real AWS (`terraform/`, see §4.10). Production compute
  (where/how the API runs) remains a deferred decision — see §5.

**Front-end (SPA)**

- React + Vite, a pure SPA (no SSR/Next.js-style file routing).
- Refresh token in `localStorage` (Option A — simple, but exposed to
  XSS); access token in memory only, never persisted. An `httpOnly`
  cookie is recorded as a future step, not implemented now.
- New back-end endpoint: `GET /auth/me` (the logged-in user's
  profile), needed because the SPA needs something to show on the
  Profile screen.
- Scope: only what the API already exposes (auth + products) — no
  admin-manageable user CRUD.

**Observability (tracing)**

- OpenTelemetry + local Jaeger (Docker Compose), exported via OTLP.
- 100% manual tracing, with no auto-instrumentation at all (not even
  HTTP): a root span per HTTP handler via `@TraceRoot()` on the
  controller itself, child spans (use case / DynamoDB / Redis) via
  `@TraceSpan()` — the same "no magic" instinct already used for the
  rate-limit. With no auto-instrumentation patching `require()`,
  import order in `main.ts` stops mattering.
- Documented exception: `app/usecases/*.usecase.ts` imports
  `observability/` directly (only for tracing) — a deliberate,
  recorded cross-cutting-concern allowance in the "usecase depends
  only on domain/" rule (see §4.1.3).

### Technical decisions, straight to the point (trade-offs)

> Each row exists to answer "why X and not Y" without reading the
> whole section. The full rationale, with the discarded alternatives
> in detail, is in the referenced section. A common thread runs
> through much of this: **what breaks once more than one instance of
> the API is running at the same time** — that's the question that
> rules out the more obvious option in several of the rows below.

| Decision | Rejected alternative | Why (the real trade-off) | Ref. |
| --- | --- | --- | --- |
| Password hash: **argon2id** | bcrypt | bcrypt only costs CPU (a rounds parameter); argon2id also demands memory (`m=19456`), which raises the cost of a GPU/ASIC attack — dedicated hardware is great at parallelizing CPU, bad at memory. The ~100ms cost per hash is deterministic and doesn't depend on state shared between instances: any API replica arrives at the same hash without consulting the others. | §4.6 |
| Rate-limit: counter **in Redis** (sliding window) | In-memory `@nestjs/throttler`; managed AWS WAF | An in-memory throttler counts *per process* — with N replicas behind a load balancer, the real limit becomes N× the configured one, because each instance never sees the request that landed on the others. Only a **shared** counter (Redis) guarantees a single, correct limit regardless of replica count. WAF was ruled out for a different reason: it only sees IP/headers, it doesn't decode the JWT — there's no way to limit per logged-in user, only per IP. | §4.3 |
| Sliding window **counter** (2 weighted fixed counters) | Sliding log (`ZSET`, one entry per request) | A sliding log is exact, but writes one entry per request — under "significant volume" (which the brief itself asks for), that's O(n) memory per window. The counter is O(1) (`INCR`/`EXPIRE`) and gets close enough to true precision. A consciously accepted trade-off: approximate precision for constant cost, the same kind of trade high-volume systems make (commercial API-gateway rate limiters use the same technique). | §4.3 |
| **RS256** JWT (asymmetric key pair) | HS256 (symmetric secret) | HS256 would require distributing the **same secret** to any service that needs to validate a token — every new consumer (a future worker, a separate IdP) becomes one more place holding the secret, more leak surface. RS256: only the issuer holds the private key; validation only needs the public key, which can be distributed freely. Validation stays 100% offline (no round-trip), so it works the same with 1 or with 50 API replicas. | §4.1.2 |
| Token revocation: **central blacklist in Redis** | Per-instance local cache (in-memory) | Logout/refresh-token rotation needs to be seen **immediately** by whichever instance receives the next request. A per-process local blacklist would create a real inconsistency window: instance A revokes, instance B (which never knew) accepts the same revoked token. Only shared state closes that window. Fails open with a short timeout if Redis goes down — the RS256 signature alone already blocks a tampered/expired token, the blacklist is incremental defense, not the only line. | §4.6 |
| **Rotating** refresh token **+ reuse detection** (cascading revocation) | Long-lived, reusable refresh token | A reusable token can't tell "the same user again" apart from "someone with a stolen copy." Single-use rotation turns any reuse into an unambiguous signal of a leaked copy — it triggers revocation of that login's whole token family, not just a denial of that one call. The same pattern used by Google/Auth0, designed for a user with multiple concurrent sessions/devices. | §4.6 |
| Listing cache: **generation counter** | Fixed TTL with no active invalidation | A TTL alone lets **any replica** serve stale data for up to the whole TTL duration after a write made on *another* replica — that's not just "old cache," it's visible inconsistency between different instances answering the same question differently. The generation counter in Redis is shared: a write on any instance invalidates every other instance's view on its next request, with no need for active invalidation (pub/sub) or tracking which keys hold which product. | §4.4 |
| **Cursor-based** pagination (opaque, `LastEvaluatedKey`) | Numeric offset (`LIMIT`/`OFFSET`) | Offset in DynamoDB would require scanning and discarding N items on every page (cost grows with the page) and breaks under concurrent writes: an item inserted/removed by *another* replica shifts everyone after it, producing a duplicate or a skipped item. An opaque cursor has constant cost per page and stays stable even with concurrent writes from other instances, because it doesn't depend on a count — only on the position of the last key read. | §4.7 |
| API IAM: **least privilege by action and resource** (not by condition) | `dynamodb:LeadingKeys` (row-level security) | Row-level security solves isolation *between rows of the same table* when tenancy/ownership exists — that concept doesn't exist in this domain. With no real row condition to restrict, isolation is already total from the policy's scope (only these two tables, nothing else). Restricting by condition here would be complexity with no purpose. | §4.10 |
| Terraform: **local state** (not S3+DynamoDB-lock) | Remote backend with locking | A remote backend solves exactly one distributed-systems problem — multiple operators running `terraform apply` **at the same time**, each needing a lock so they don't step on each other. That problem doesn't exist here (a single operator, an evaluation project). Implementing distributed locking without that real concurrency would be solving a problem that doesn't exist, at the cost of a chicken-and-egg bootstrap (the state bucket itself needs its own infra). Documented as a future step, not implemented. | §4.10 |

### 4.1 Architecture decisions

#### 4.1.1 Single service (not microservices)

Auth and Products live in the **same deployable service**, organized
as isolated internal modules (`auth/`, `products/`, `rate-limit/`).
Reason: JWT is already stateless by nature — validation doesn't depend
on a call back to the issuer — so "readiness for distribution" comes
from the token's design (see 4.1.2), not from physically splitting
services. Splitting physically today would add infra overhead (two
deploys, service-to-service trust) disproportionate to the scope (a
single consumer of authentication).

#### 4.1.2 Asymmetric JWT (RS256)

Signed with an RS256 key pair (not HS256). Whoever issues the token
holds the private key; whoever validates it only needs the public key.
This leaves the system ready for eventually extracting a separate
Identity Provider later, without needing to share a symmetric secret
between services — the same model used by Cognito/Auth0/Keycloak.

#### 4.1.3 Layered Clean Architecture

Organized by **layer**, not by business module, inside
`apps/api/src/`. Organizing by business module (`auth/`, `products/`,
`rate-limit/`, each with its own controller+service+repository) tends
to mix infrastructure (Redis, DynamoDB, JWT) with business logic
inside the same folder — nothing stops, say, a service from ending up
depending directly on a concrete class that talks to Redis, without
going through an interface. Organizing by layer avoids that trap
structurally: each folder corresponds to a layer in the dependency
rule (see below), not to a business area.

Organization, inside `apps/api/src/`:

```text
src/
├── main.ts               → bootstrap: CORS, ValidationPipe (Zod), Swagger
├── app.module.ts          → single import: PresentationModule
│
├── presentation/           → HTTP entry adapter
│   └── http/
│       ├── controllers/    → auth, products, health
│       ├── dtos/           → Zod request/response schemas per route
│       └── presenters/     → formats domain model → HTTP response
│
├── app/usecases/            → business logic (orchestration), agnostic
│   ├── authenticate/        → login, refresh, logout
│   ├── user/                → registration
│   ├── products/            → create, update, delete, list
│   └── rate-limit/           (guard lives in infra/, see below)
│
├── infra/                    → every concrete I/O implementation
│   ├── auth/                 → jwt-auth.guard (global) + @Public(),
│   │                           jwt.strategy, current-user decorator
│   ├── cryptography/          → argon2-hasher, jwt-encrypter
│   ├── cache/                 → Redis client, revocation store,
│   │                           rate-limit counter (sliding window)
│   ├── database/dynamodb/     → client, mappers, repositories, bootstrap/seed
│   ├── env/                   → env var validation with Zod
│   └── swagger/
│
├── observability/            → distributed tracing (OpenTelemetry) - cross-cutting,
│                                not a domain port implemented by infra/;
│                                used by app/usecases, presentation, and main.ts
│
└── domain/                    → zero framework dependency
    ├── models/                 → entities (User, Product)
    ├── protocols/               → interfaces (ports): cryptography,
    │                              cache, database/repositories
    └── usecases/                → `I<Name>UseCase` interfaces (contract),
                                    implemented in app/usecases/
```

Dependency rule: `domain` imports nothing from outside; `app/usecases`
depends only on interfaces from `domain/protocols` and on
`observability/` (cross-cutting — tracing, the same status as
NestJS's own decorators, not a port to implement); `infra` implements
`domain`'s interfaces; `presentation` depends on `app/usecases`,
`infra`, and `observability/`. That's what guarantees business logic
can be tested by mocking an interface (no real LocalStack/Redis in a
unit test) and any infrastructure piece can be swapped without
touching `app/` or `domain/` — the same guarantee holds end to end in
the code, not just for persistence.

#### 4.1.4 Separate DynamoDB tables, by access pattern

Two tables, each with its own natural key: `Users` (key `email`) and
`Products` (key `productId`). `Users` and `Products` have **no
combined access pattern** — no tenant/ownership between them (see
§4.7) — and token rate-limit/blacklist live in Redis (see §4.3 and
§4.6), not DynamoDB, so no query ever needs to read both entities
together in one operation.

Separate tables, each with its own business key, are simpler to read,
document, and test — no generic attribute names or key-prefix
discipline needed across different entities.

**Exact modeling** (settled during implementation — the
`add-auth-and-products-api` OpenSpec change, see the archived
`design.md`):

- **`Users`**: primary key `email` (enables a direct lookup on login
  and uniqueness via a `ConditionExpression` on registration);
  `userId` is the JWT's `sub` claim and also has its own GSI
  (`byUserId`) — added alongside `GET /auth/me` (§4.8), which only has
  the token's `userId` to find the user, not the e-mail.
- **`Products`**: primary key `productId`; two GSIs —
  `byCategoryActive` (`gsi1pk = category#active`, `nameSortKey` as the
  sort key) for filtering by category (with or without a name
  prefix), and `byActive` (`gsi2pk = active`, same sort key) for
  listing/filtering by name with no category. `active` embedded in
  both partition keys avoids a `FilterExpression` to exclude inactive
  products — the exclusion already happens in the partition being
  queried.

#### 4.1.5 `/v1` version prefix on routes

Business routes are served under `/v1`: the prefix lives on the
controller itself (`@Controller('v1/auth')`, `@Controller('v1/products')`).
That way the public path carries the version from v1 onward, and a
future v2 can coexist without breaking v1 clients, at no cost now.
`HealthController` stays on `@Controller('health')` — a liveness probe
points at a stable, unversioned path — and Swagger UI stays at `/docs`.
Neither Nest's `enableVersioning()` (per-controller
`version`/`VERSION_NEUTRAL` bookkeeping) nor `setGlobalPrefix` (the
prefix disappears from where the route is declared) is used; with few
controllers, the segment in `@Controller()` is explicit and lives
right where the route is read.

### 4.2 Technology stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| HTTP framework | **NestJS** | Guards map directly to the protected route; DI reinforces module separation; `@nestjs/swagger` generates OpenAPI automatically; testable via `@nestjs/testing` |
| Auth/JWT | `@nestjs/jwt` + `@nestjs/passport` (`passport-jwt`) | Nest ecosystem standard |
| JWT signing | `jsonwebtoken`/`jose`, RS256 key pair | see 4.1.2 |
| Password hash | `argon2` | more modern/secure than bcrypt |
| Validation | **Zod** (`nestjs-zod`) | schemas shareable with the front-end via `packages/common` |
| Data access | `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` (Document Client) | typed access straight to the Document Client; each module's repository (see 4.1.3) encapsulates its own queries |
| Tests (API) | Jest + `supertest` (e2e) + LocalStack/dynamodb-local (integration) | covers unit and real integration |
| Front-end (build) | React + Vite | Vite is today's standard, CRA is deprecated |
| Front-end (routing) | React Router (data routers) | the SPA equivalent to the file-based routing from Next.js in the original template — includes "modal routes" for the product form |
| Front-end (styling) | Tailwind + shadcn/ui | components copied into the repo (not an npm UI dependency), Radix underneath |
| Front-end (server data) | React Query | cache, invalidation on mutation, retry |
| Front-end (forms) | `react-hook-form` + Zod | reuses the same `packages/common` schemas the API uses in its DTOs |
| Front-end (HTTP) | `axios` (`src/lib/http-client.ts`) | request/response interceptors cover token injection and refresh-and-retry with single-flight on `401` |
| Tests (front-end) | Vitest + Testing Library (unit/component) + Playwright (e2e against the real API) | same back-end philosophy: verify against the real stack, don't assume |

### 4.3 Distributed rate-limit

**Not used:** an in-memory throttler (`@nestjs/throttler` in its
default mode) — it doesn't work correctly with multiple concurrent
instances/executions, since each would have its own local counter.
Also not used: **AWS WAF as a service** — a deliberate decision to
reproduce, in the application itself, the *logic* of a WAF rate-based
rule (evaluated over a rolling/continuous window, re-evaluated at
short intervals — not an abrupt fixed-window reset), without
delegating execution to a managed service.

**Decision:** a counter in **Redis**, with a **sliding window**
algorithm — not a fixed window — to reproduce a WAF rate-based rule's
continuous behavior and avoid the classic edge-of-window burst problem
of a fixed window (2x the limit around the reset).

Mechanics:

- Aggregation key: `userId` on authenticated routes, IP on anonymous
  routes (e.g. login) — more precise than WAF, which only sees
  IP/headers/cookies, without decoding the JWT
- Configurable limit per route, in the same spirit as multiple WAF
  rate-based rules per path (e.g. login stricter than listing)
- Response when exceeded: `429 Too Many Requests` + `Retry-After`
- Algorithm variant: **sliding window counter** — two fixed-window
  counters (current + previous) weighted by the fraction of the
  current window elapsed (`estimate = previous × (1 − fraction) +
  current`); O(1) per request (`INCR`/`EXPIRE`), a very close
  approximation of an exact sliding window at a much lower cost than a
  per-request log (ZSET). Run via a Lua script in Redis for atomicity
  between read and write.

Implemented as its own module (`rate-limit/`), with its own
port/repository, pluggable as a Nest Guard/Interceptor.

**Resilience (Redis unavailable):** *fail-open* + a warning log, both
for this guard and for the token-blacklist check (see §4.6) — both
depend on Redis. The ioredis client is configured to fail fast
instead of hanging the request (`redis-client.provider.ts`:
`connectTimeout: 200`, `maxRetriesPerRequest: 1`); the adapter catches
the resulting exception, logs a warning, and proceeds without a
rate-limit / without an immediate revocation check. An explicit
per-operation timeout (`Promise.race`) is recorded as a possible
reinforcement, not implemented. Rationale: Redis here is a
*secondary* defense layer (authentication itself stays guaranteed by
the RS256 signature and token expiry); if Redis goes down, degrading
to "temporarily no rate-limit/no immediate revocation" is preferable
to taking the whole API down because of a dependency that isn't the
primary one.

**Real IP behind a reverse proxy (`TRUST_PROXY_HOPS`).** Keying by IP
on anonymous routes only works if `request.ip` reflects the real
client — without that, behind any load balancer/reverse proxy (ALB,
nginx), every anonymous request would resolve to the proxy's own IP,
collapsing everyone passing through it into a single rate-limit bucket
(worse still on login: one client hitting the limit would block
everyone else behind the same proxy). Fixed by configuring
`app.set('trust proxy', ...)` at bootstrap (`main.ts`), controlled by
the `TRUST_PROXY_HOPS` env var (default `0` = trust no proxy —
identical to today's behavior, correct because no load balancer is
provisioned yet). Once the compute/network decision is made (see §7,
Next steps / roadmap), whoever provisions the real infra must adjust
this env var too — it isn't automatic. Found during a documentation
review (`docs_to_dev/analise-dos-problemas.md`), fixed in the
`fix-rate-limit-trust-proxy` change (see its `design.md` for the full
rationale on why a hop counter, and not a boolean or an IP/CIDR
allowlist).

### 4.4 Cache

**Decision:** a dedicated **Redis** cache in front of DynamoDB for the
product listing (`GET /products`) — reuses the infra already
provisioned for rate-limit/blacklist (see §4.3 and §4.6), instead of
introducing a new infra component just for this.

**Invalidation: generation counter + short TTL.** Simple cache-aside —
on a miss, read from DynamoDB and write to Redis with `EX` (45s). Every
write (create/update/delete) does `INCR products:list:gen`; the
current generation goes into the cache key
(`products:list:v<gen>:...`), so a bump makes every cached page
unreachable at once, with no need to track which keys hold which
product. Orphaned entries age out on their own via the TTL. A read
memoizes the generation for ~1s so it doesn't cost a round-trip per
request. Fails open like the rest of the cache: if Redis goes down,
`getGeneration()` returns 0 and `bumpGeneration()` is a no-op — the
write doesn't fail, staleness just falls back to the TTL alone.

> **History:** v1 of this section used only a short TTL (30-60s), with
> no write-time invalidation, and listed the generation counter as a
> discarded alternative. The `refine-observability-and-web-fixes`
> change adopted the counter after "creating/deleting a product
> doesn't show up in the listing" surfaced as a real bug in the SPA.

Client-side/CDN cache headers (`Cache-Control` + `ETag`) on
`GET /products` are recorded as a future step — the API doesn't emit
them today (the only header it sets is the rate-limit's
`Retry-After`). The CDN itself is also a deferred infrastructure
detail (see §5).

DAX remains out of scope (see §5) — the Redis cache already covers
the listing's read pattern without needing another dedicated
component.

### 4.5 Monorepo structure (Turborepo)

```text
apps/
  api/       → NestJS (backend)
  web/       → React SPA (Vite)
packages/
  common/    → Zod schemas / DTOs / types shared between api and web
```

Standard Turborepo convention: `apps/` only holds deployables
(something that runs on its own), `packages/` holds shared code
consumed by more than one deployable. We considered putting `common`
inside `apps/` (one less folder level), but the very reason `common`
exists as a separate package — being consumed by `api` **and** `web`,
two independent applications — is exactly the use case the
`apps`/`packages` split solves: keeping `common` out of `apps/` avoids
automation or anyone reading the repo having to treat a
non-deployable folder as an exception inside `apps/`.

`turbo build --filter=api...` builds only the API and its
`packages/common` dependencies, without touching the front-end's
build — the API's build artifact stays isolated from the front-end.
Each app's deploy target (cloud, container, etc.) is a deferred
decision — see §5.

### 4.6 Business rules — Authentication

**User registration:** a public registration endpoint **and** a
seed/fixture to populate a dev/demo environment — the two coexist,
it's not one or the other.

**Login, refresh, and logout with revocation:**

- Access token: JWT RS256, **15-minute** TTL. It's the token sent on
  every protected request.
- Refresh token: JWT RS256, **7-day** TTL, **sliding** type (renews on
  every use — an active user never needs to log in again; the session
  only expires after 7 days of inactivity). A claim distinguishes the
  type (`type: refresh`).
- Rotating (single-use) refresh: on every use, the old refresh token
  goes to the blacklist (by `jti`) and a new pair is issued.
- **Reuse detection (token-theft protection):** if an already-used/
  blacklisted refresh token is presented again, that's a signal
  someone else has a copy of it. In that case, it cascades revocation
  across **the whole token family** from that login — not just denying
  that one call. The same defense pattern used by Google and Auth0.
- Logout: puts the current access token's and refresh token's `jti`
  on the blacklist.
- The blacklist is implemented in **Redis** (key `blacklist:<jti>`,
  TTL = time remaining until the token's natural expiry) — reuses the
  infra already provisioned for the rate-limit (see §4.3).
- Every protected request: validates the RS256 signature (offline) +
  checks the Redis blacklist.
- Resilience to a Redis failure: see §4.3 (fail-open).

**Token claims:** no roles/scopes (there's no role-based authorization
in this project). What `jwt-encrypter.ts` issues today: `sub` (the
`userId`), `jti`, `familyId` (identifies that login's token family,
the basis for cascading revocation), `type` (`access` or `refresh`),
plus `iat`/`exp` from `expiresIn`. An `iss` (issuer) claim is recorded
as a natural next step for when there's more than one token verifier —
today, with a single service validating, it adds nothing.

**User-enumeration protection:** login/registration responses must not
reveal whether a specific e-mail already exists in the database
(generic error message, equivalent response time between "nonexistent
e-mail" and "wrong password") — part of the project's general focus
on resilience and security.

**Password policy:** at least 8 characters, an uppercase letter, a
lowercase letter, a number, and no whitespace (a space, especially at
the start/end, is usually a silent typo - rejecting it up front beats
accepting a credential the user wouldn't type the same way again).
A deliberate choice for a classic composition rule (what the market
usually expects); worth noting NIST SP 800-63B currently recommends
the opposite — a longer minimum length and checking against leaked
password lists, with no forced composition rule.

**Password hash:** `argon2id`, with OWASP's baseline parameters:
`m=19456` (19 MiB), `t=2`, `p=1` — adequate security with predictable
CPU/memory cost (~100ms per hash) and portable across environments.

**Authenticated user's profile:** `GET /auth/me`, a protected route
that returns the `userId`/`email`/`createdAt` of the access token's
owner — added alongside the front-end (§4.8), which needs something to
show on the Profile screen. Uses the same guard/revocation check as
every protected route; no change to login/refresh/logout.

### 4.7 Business rules — Product

**Fields:** the minimum needed for the catalog; `category` as an
**ENUM** (fixed, small cardinality — avoids free text and helps model
the category GSI in DynamoDB).

**No multi-tenant** — a single, global catalog.

**Full CRUD:** create, update, delete, plus listing. Since there's no
role-based authorization (see §4.6), any authenticated user can
create/edit/delete any product — a deliberate decision given the
absence of roles in scope, not a forgotten gap.

**Deactivate vs. delete (two distinct operations):**

- **Deactivate** is done via `UPDATE` (`active = false`) — keeps the
  product in the database (history, orders that already reference
  that product stay intact). The listing filters on `active = true`.
- **Delete** (`DELETE`) is a **physical removal** of the item from
  DynamoDB, regardless of the `active` value — a distinct, rarer
  action than deactivating.

**Filters:** by name and by category, combinable.

- Name: filtered by **prefix** (`begins_with`), native to DynamoDB via
  `Query` — no extra infra. `contains`/full-text has no native way in
  DynamoDB (only via `Scan`, expensive, or an external index like
  OpenSearch, both out of scope now); recorded as a future step (see
  §5).
- Implies a lowercase-normalized name as the sort attribute
  (`begins_with` is case-sensitive) and a GSI with a fixed partition
  key to allow a prefix across the whole catalog when the name filter
  is used without a category — exact modeling in §4.1.4.

**Sorting:** stable — a sort key tie-broken by `id`, guaranteeing
deterministic order across pages even for items with the same sort
value.

**Pagination:** cursor-based, internally using DynamoDB's
`LastEvaluatedKey` — but **never exposed raw in the API**. It's
encoded as an opaque token (e.g. base64 of JSON) in the response field
(`next_cursor`), following the common REST API pattern (GitHub,
Stripe). This avoids coupling the API's public contract to DynamoDB's
internal key structure — the table's modeling can change later
without breaking clients.

**Read protection:** a dedicated Redis cache in front of DynamoDB for
the listing (see §4.4) — reuses the Redis already provisioned by the
rate-limit/blacklist.

### 4.8 Front-end (SPA)

Formalized as its own OpenSpec change (`add-web-spa`) after the API
had already been implemented and archived — capabilities `web-spa`
(new) and `user-auth` (modified, only the profile Requirement).

**Why an SPA and not Next.js.** The conversation's starting point was
a folder-structure template clearly from Next.js App Router
(`middleware.ts`, file-based routes, a parallel `@modal` slot, an
intercepting route `(.)users/[...form]`, `app/api/auth/[...nextauth]`).
Decision: keep the SPA (React + Vite), as already recorded in §4.2/§4.5
even before this conversation — no dedicated server, static hosting.
From the original template, the transferable ideas survive
(`components/ui`/`composition`/`layout`, `providers`,
`lib/http-service` → `lib/http-client` with `axios`, `hooks`,
`services`); what has no SPA equivalent (file-based routing, Server
Actions, NextAuth) was dropped. Next's "modal route" becomes a nested
React Router route rendered in a `<Dialog>` — the same UX idea,
without needing an SSR framework.

**Browser-side session — the most consequential decision.** The API
already returns `accessToken`+`refreshToken` in the response body
(login/refresh) — that forces a choice of where to keep each one on
the client:

| Option | XSS exposure | Changes the API? |
| --- | --- | --- |
| **A. Both in `localStorage`** (chosen) | High | No |
| B. Access in memory + refresh in `localStorage` | Medium (only the refresh is exposed) | No |
| C. Refresh in an `httpOnly` cookie | Low | Yes (`Set-Cookie`, CORS with credentials, `SameSite`) |

**Option A** was chosen for implementation simplicity at this stage,
with the trade-off explicitly documented (not a forgotten gap): any
successful XSS on the page reads both tokens. Partially mitigated by
the refresh being single-use (a stolen copy is only usable until the
next legitimate refresh, which already cascades revocation on reuse —
see §4.6). An `httpOnly` cookie (Option C) is recorded as a future
step — it would require changing how the API issues the refresh token,
which wasn't done here so as not to reopen the already implemented and
tested `POST /auth/login`/`POST /auth/refresh` contract.

**A real bug found during manual verification (not yet caught by
Playwright):** the session's bootstrap effect (silent refresh on page
reload) originally called refresh directly, without going through the
same dedup used by the 401 interceptor. Since React 18's `StrictMode`
runs effects twice in dev, two concurrent calls used the same
(single-use) refresh token — the second looked like reuse of an
already-rotated token, triggering cascading revocation (§4.6) and
dropping the session minutes after "logging in successfully." Fixed
by routing the bootstrap through the same `refreshSessionOnce`
(in-flight dedup) the HTTP interceptor already used. Full detail in
`openspec/changes/archive/.../add-web-spa/design.md` after archiving.

**Listing cache and tests.** Originally, the listing could serve a
page up to 45s stale even after a write, and the "my product
appeared/disappeared from the list" tests worked around that using a
filter that was never queried before (a fresh cache key). With the
generation counter (§4.4, added in the
`refine-observability-and-web-fixes` change), a write invalidates
every cached page, so re-querying the same filter right afterward
already reflects the write - the workaround was removed from the
tests.

### 4.9 Observability (distributed tracing)

Formalized as its own OpenSpec change (`add-tracing-observability`), a
new `observability` capability, with no existing capability modified
(it's a purely operational addition — no observable behavior of
auth/products/rate-limit/web-spa changes).

**Starting point:** an already-built tracing kit from another project
(an order-matching service) — the OpenTelemetry SDK plus a `Trace`
class that uses OTel baggage to propagate business context
(`orderId`/`orderType`/`orderPair`/`userId`) from a root span down to
child spans, plus decorators (`TraceRoot`/`TraceParent`/`TraceSpan`) to
apply it. Adapted to this project's domain and layering rules, not
simply relocated.

**Jaeger via native OTLP, no dedicated exporter.** Modern Jaeger
(≥1.35) already speaks OTLP (`:4318` HTTP) and has its own UI
(`:16686`) — the original kit already exported via OTLP, it just
needed to point at the local Jaeger instead of a generic/Datadog
fallback (removed — `DD_AGENT_HOST` had nothing to do with this
project).

**Manual tracing instead of auto-instrumentation.** Considered
`@opentelemetry/instrumentation-aws-sdk`/`-ioredis` for DynamoDB/Redis
— they give richer attributes for free (table name, exact Redis
command), but were dropped in favor of the manual `@TraceSpan()`
decorator, for the same reason the rate-limit was implemented in the
application itself instead of delegated to WAF (see §4.3): preferring
explicit over monkey-patch magic. Accepted cost: no automatic
`db.system`/`aws.dynamodb.table_names` attribute — can be added by
hand later if a specific investigation needs it.

> **Update (`refine-observability-and-web-fixes`):** the one remaining
> auto-instrumentation, `HttpInstrumentation`, was also removed — the
> root span is now opened by `@TraceRoot()` directly on the controller
> (see below). The SDK runs with no instrumentation at all, and
> `main.ts` no longer needs to be imported before `@nestjs/core`.

**Root span: a global Interceptor, not a per-controller decorator.**
The original kit's `TraceRoot` assumes decorating every controller
method by hand. This project already has precedent for "applies to
every route without annotating one by one":
`JwtAuthGuard`/`RateLimitGuard` are global via `APP_GUARD`. A
`TracingInterceptor` via `APP_INTERCEPTOR` follows the same pattern —
zero risk of a new route being born without a trace.

> **Reversed in `refine-observability-and-web-fixes`:** the root span
> went back to being a per-handler decorator (`@TraceRoot()`), opened
> explicitly at the entry point. The global `TracingInterceptor` was
> removed; a guard test (`trace-root-coverage.spec.ts`) guarantees
> every handler on every controller carries the decorator, covering
> the risk the global interceptor used to prevent.

**The real exception: `app/usecases` importing `infra/`.** Every
`app/usecases/*.usecase.ts` today only imports `domain/` —
`usecases.module.ts` is the only file under `app/` that touches
`infra/`, and only for DI wiring. Decorating `execute()` with
`@TraceSpan()` breaks that line for the first time. Two alternatives
that would have preserved the rule were evaluated and dropped: (1)
skip the use-case span entirely (would leave the most meaningful
business boundary invisible); (2) a real port (`ITracer` in
`domain/protocols/`, constructor-injected) — would preserve the rule,
but would require wrapping each method's body in a closure instead of
a simple decorator, a more invasive change to already-tested methods,
for a concern that (unlike `IUserRepository`) no use case will ever
need to swap out at the business level. **Decision:** accept the
documented exception — tracing is treated as a cross-cutting concern
(observability plumbing), not a business dependency, the same
distinction that already exists between "a port I need to go through"
(repositories, hasher) and "framework wiring I don't abstract"
(`usecases.module.ts` already imports `InfraModule` directly).

**Really verified, not assumed:** the 96 unit tests passed with no
changes (the decorator is mute — no span, zero cost — when called
outside an active trace, exactly what every unit test does when
instantiating these classes directly); and, with the local stack
actually running, an authenticated request (`GET /products`) produced
exactly the expected tree in Jaeger
(`ProductsController.list` → `usecase.ListProductsUseCase.execute` →
`cache.RedisProductListCache.get` → `repository.DynamoDbProductRepository.list`
→ `cache.RedisProductListCache.set`, all carrying `user.id`), a public
request (`POST /auth/login`) produced a trace with no `user.id`, and
stopping the Jaeger container didn't block or delay requests (~3ms,
same as before) — export is asynchronous (`BatchSpanProcessor`), off
the response path.

### 4.10 Cloud infrastructure (Terraform)

Formalized as its own OpenSpec change (`add-terraform-infra`), a new
`cloud-infra` capability, with no existing capability modified (a
purely infrastructural addition — no observable behavior of
`user-auth`/`products`/`rate-limit`/`web-spa`/`observability` changes,
no `apps/api` code is touched).

**Why, and why this entry changed category.** An earlier version of
this document listed "cloud deployment infrastructure (compute,
network, Terraform)" as a whole as out of scope, treating Terraform as
a deferrable architecture decision just like CI/CD or DAX. It isn't:
the challenge's original brief lists Terraform as a mandatory
technical requirement and "understanding and use of cloud
infrastructure" as an evaluation criterion — named, not inferred.
Fixed by splitting that single entry into two: persistence (tables +
IAM), which has a named requirement and is now actually provisioned;
compute/network, which has no named requirement and remains deferred
(see §5).

**Minimal scope, not full infrastructure.** The module in `terraform/`
(see `terraform/README.md`) provisions only what the schema already
implemented against LocalStack (§4.1.4) needs to really exist in AWS:
the `Users`/`Products` tables with the GSIs already designed, and an
IAM role/policy for the API's access to them, restricted by action
(`GetItem`/`PutItem`/`UpdateItem`/`DeleteItem`/`Query`, no `Scan`) and
by resource (only these two tables and their indexes — no
`dynamodb:LeadingKeys`/row-level security, which doesn't apply: there's
no tenant/ownership in this domain, see §4.7). Production compute
(ECS/Fargate/App Runner/Lambda), networking (VPC/ALB), and CI/CD to
apply it automatically remain out of scope — they aren't named
requirements, unlike Terraform itself (see §5).

**Local state, remote backend documented as a future step, not
implemented.** A working S3+DynamoDB-lock backend requires
provisioning the bucket/lock table itself before any state exists for
them — a bootstrapping problem disproportionate to the scope (no
concurrent operator running Terraform, the scenario a remote backend
solves). Documented as the natural next step in the module's
`README.md`.

**IAM role trust policy: deliberately neutral.** Since production
compute remains a deferred decision, the role assumes a neutral trust
policy (trusts its own account root), documented as a placeholder to
be replaced by the real compute identity (an ECS task role, a Lambda
execution role, etc.) once that decision is made — instead of
assuming a specific compute service with no need to.

**Really verified, not assumed — with no AWS account available.**
With no credentials for a real AWS account in this environment,
`terraform plan` against real AWS isn't runnable (a risk already
documented in the change's `design.md`, with the mitigation that the
reviewable deliverable is the configuration's correctness, not a real
apply). Instead of stopping at `terraform validate`, the whole cycle
(`plan` → `apply` → inspecting the real state → `destroy`) was
verified against a disposable LocalStack container with
`dynamodb`/`iam`/`sts` enabled — the same mechanism this project
already uses for DynamoDB in dev (`docker-compose.yml`), just in a
separate container, never committed. `apply` produced exactly 5
resources (the two tables, the policy, the role, the attachment);
inspecting the real state confirmed the three GSIs (`byUserId`,
`byCategoryActive`, `byActive`) with the exact key schema used by
`users.table.ts`/`products.table.ts`. Destroyed right after — no
residue in the repository.

## 5. Deliberate scope decisions

This is an evaluation challenge, not a production system — avoiding
over-engineering here is as deliberate as any technical decision
recorded in §4. The items below weren't built because, for this
delivery's scope, they weren't worth it — not because they weren't
considered. In a real architecture, especially a distributed one with
multiple microservices, several of these choices would likely be
different (see §6 for the concrete points on that).

- Production compute (ECS/Fargate/App Runner/Lambda) and networking
  (VPC, ALB, security groups) — where/how the API runs in production
  remains a deferred decision. The persistence layer (DynamoDB tables
  + access IAM), however, is **no longer** deferred — it was
  provisioned via Terraform in the `add-terraform-infra` change (see
  `terraform/README.md`), because Terraform is a named technical
  requirement in the brief, not an optional architecture decision the
  way compute/network are.
- CI/CD — will be handled at a later stage
- DAX (dedicated cache) — documented future step, not implemented in v1
- Name search with `contains`/full-text (e.g. via OpenSearch) —
  documented future step, v1 uses a prefix filter (see §4.7)
- Physically splitting auth into a microservice — the architecture is
  already prepared for it (stateless RS256 JWT), but it won't be done
  in this delivery

## 6. If this were a real system...

The question that organizes this section: which of the decisions above
were shaped by the constraints of *this specific challenge* (the brief
mandating DynamoDB, the evaluation scope, a single service), and what
would change in a real architecture — especially a distributed one,
with multiple microservices?

**DynamoDB vs. a relational database for `Products`.** DynamoDB was a
named requirement from the brief, not a free choice (see §3). It fits
the catalog's *current* access pattern well — filtering by category
and name prefix, no joins, no ad-hoc queries (see §4.1.4) — but a real
product catalog tends to grow in relational complexity: variants,
price tiers, suppliers, per-warehouse stock, promotions that depend on
several entities at once. In that richer scenario, the case for a
relational database (PostgreSQL) grows stronger — ACID across related
entities and `JOIN`s stop being a luxury and become the requirement
itself. Both points are true at different scales: DynamoDB serves
today's scope well; a richer product domain would tip the balance the
other way.

**Centralized token revocation.** Today the blacklist lives in this
service's own Redis (§4.6). In a scenario with multiple services
validating the same token, a central identity service (Cognito/Auth0/
Keycloak) doing token introspection would keep each service from
reimplementing its own blacklist — the architecture is already
partway ready for this (asymmetric RS256, see §4.1.2), only the
central service itself is missing.

**Rate-limit centralized in an API Gateway.** The sliding-window logic
is embedded in the application (§4.3) because today there's only one
application. In front of N services, a real API Gateway (Kong, AWS API
Gateway) applying rate-limit once, at the edge, would avoid
reimplementing the same logic in every service.

**Event-driven cache invalidation, not synchronous.** The generation
counter (§4.4) invalidates the cache synchronously, on the write
itself. In a system with multiple services consuming the catalog, an
event (`ProductUpdated` via SNS/EventBridge) would let each consumer
invalidate/update its own cache asynchronously, without coupling
whoever writes to everyone who reads.

**No messaging between services.** Today everything is synchronous
request/response because there's only one service (§4.1.1) — there's
no queue or event bus. A real distributed system would have some
asynchronous mechanism between services for cases where an immediate
response isn't needed.

**No idempotency key on `POST /products`.** With no automatic
gateway/client retries in the path, creating the same product twice
via a retry isn't a risk the current project needs to handle — but it
becomes a real risk as soon as a gateway or client with automatic
retry sits in front of the API.

**Partial observability.** Today only distributed tracing exists
(Jaeger, §4.9) — enough to debug a single application. Missing:
metrics (Prometheus/Grafana) and log aggregation (CloudWatch/ELK),
which become necessary as soon as there's more than one service to
correlate.

**Neutral IAM role trust policy.** Already documented as pending in
§4.10 — a real system would have the specific compute identity (an
ECS task role, a Lambda execution role) in place of today's
placeholder.

## 7. Next steps / roadmap

**Compute (roadmap, not implemented in this delivery).** Target
topology diagram at
[`docs/diagrams/deploy-topology-roadmap.md`](../docs/diagrams/deploy-topology-roadmap.md).
Explicitly recorded here is what's missing to really run the API on
AWS (and why it wasn't done now — not an oversight, it's scope: none
of these items is a named requirement in the brief, unlike Terraform
itself, see §5):

- **Compute** (ECS Fargate, App Runner, or Lambda) — the
  [`apps/api/Dockerfile`](../apps/api/Dockerfile) already exists, so
  the build artifact is already ready; only the service definition is
  missing.
- **ElastiCache (managed Redis)** — a real blocker before it makes
  sense to put the API in production: without it, rate-limit/cache/
  blacklist (which depend on Redis, see §4.3/§4.4/§4.6) would run in
  permanent fail-open against real data, hiding precisely the
  features this project exists to demonstrate. This is the item I'd
  prioritize **before** compute, not after.
- **Networking (VPC, private subnets, security groups)** — where
  compute and ElastiCache live; not even designed today. Once that
  decision is made, also adjust `TRUST_PROXY_HOPS` (see §4.3) to the
  chosen load balancer's real hop count — the env var and the code
  already exist, only the real value is missing.
- **Secrets Manager/SSM** for the RS256 keys — today they only exist
  as a local file (`keys/*.pem`, gitignored), acceptable for dev, not
  for production.
- **Metrics (Prometheus/Grafana) and log aggregation (CloudWatch/ELK)**
  — today only distributed tracing exists (Jaeger, §4.9), enough to
  debug a single application; aggregated metrics and logs become
  necessary as soon as there's more than one service to correlate
  (see also §6, "Partial observability").
- **Why this can't be verified the same way I did with DynamoDB/IAM**
  (see §4.10): ECS/VPC/ElastiCache aren't emulated in open-source
  LocalStack (they're Pro-edition resources) — I'd have no way to
  really apply/inspect/destroy them without a real AWS account, so I
  wouldn't write `.tf` never tested with the same rigor as the rest of
  this project.

**Refresh-token rotation isn't atomic (a known, unfixed race
condition).** Found via manual testing, reproduced by firing two
simultaneous `POST /auth/refresh` calls with the same refresh token:
`RefreshTokenUseCase` does "check if already used" and "mark as used"
as two separate Redis calls (check-then-set), not one atomic
operation. Two concurrent requests with the same token can both read
"not yet used" before either one writes — the result: a single-use
refresh token produces two valid token pairs, and reuse detection
never fires. A realistic scenario with multiple tabs/devices for the
same user, not something hypothetical. **Known fix, not implemented
now:** the same pattern already used in the rate-limit
(`docs_to_dev/rate-limit.md`) — a Lua script doing an atomic read+write
in Redis, instead of two separate calls. Documented as a future
implementation instead of fixed in this delivery; see
`docs_to_dev/auth.md` for the full reproduction and rationale.
