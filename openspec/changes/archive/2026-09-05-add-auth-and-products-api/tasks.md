## 1. Local development environment

- [x] 1.1 Set up Docker Compose with LocalStack (DynamoDB) and Redis
- [x] 1.2 Create the API's Dockerfile (NestJS)
- [x] 1.3 Confirm/adjust the Turborepo monorepo scaffolding (`apps/api`,
      `apps/web`, `packages/common`) — `apps/web` deliberately not
      created: no spec in this change covers the front-end, left for a
      future change

## 2. Data modeling (DynamoDB)

- [x] 2.1 Define the `Users` table's primary key and attributes
- [x] 2.2 Define the `Products` table's primary key, GSIs, and
      attributes (GSI by category; fixed-partition-key GSI for a name
      prefix with no category filter, with a lowercase-normalized name
      attribute)
- [x] 2.3 Provision both tables in LocalStack (local bootstrap script,
      no Terraform)
- [x] 2.4 Implement a user/product seed/fixture for dev

## 3. Authentication module (`auth/`)

- [x] 3.1 Generate an RS256 key pair and configure loading
      (environment variable/local file)
- [x] 3.2 Implement the repository port + DynamoDB adapter for `Users`
- [x] 3.3 Registration endpoint (`POST /auth/register`) with password
      policy validation and `argon2id` hashing (`m=19456`, `t=2`,
      `p=1`)
- [x] 3.4 Login endpoint (`POST /auth/login`) with a generic response
      and equivalent response time for a nonexistent e-mail vs. a
      wrong password
- [x] 3.5 Issue an access token (JWT RS256, 15 min) and a refresh
      token (JWT RS256, 7 days, sliding) with `sub`/`user_id`, `jti`
      claims
- [x] 3.6 Refresh endpoint (`POST /auth/refresh`) with single-use
      rotation (the old refresh token goes to the blacklist on every
      use)
- [x] 3.7 Refresh-token reuse detection: cascading revocation of the
      session's whole token family
- [x] 3.8 Logout endpoint (`POST /auth/logout`): blacklists the
      `jti` of the access token and the current refresh token
- [x] 3.9 Authentication guard: validates the RS256 signature +
      expiry + Redis blacklist check, with fail-open (short timeout +
      log) if Redis is unavailable
- [x] 3.10 Unit tests for the auth module (mocked repository and
      Redis client)

## 4. Rate-limit module (`rate-limit/`)

- [x] 4.1 Implement a sliding-window-counter in Redis (a Lua script
      guaranteeing atomicity between read and write)
- [x] 4.2 A rate-limit Guard/Interceptor configurable per route (limit
      and window) — `@RateLimit()` + global `RateLimitGuard`
- [x] 4.3 `429 Too Many Requests` response + `Retry-After` header when
      the limit is exceeded
- [x] 4.4 Fail-open with a short timeout and a warning log when Redis
      is unavailable (reuses the Redis client already configured with
      a short timeout for the auth module)
- [x] 4.5 Configure the aggregation key by `userId` (authenticated
      routes) or IP (anonymous routes) and differentiated limits
      (login: 5/60s vs. default: 100/60s)
- [x] 4.6 Unit tests (guard + mocked adapter) and an integration test
      against real Redis covering the scenario of requests crossing a
      window boundary
      (`test/integration/redis-rate-limiter.integration-spec.ts`)

## 5. Products module (`products/`)

- [x] 5.1 Implement the repository port + DynamoDB adapter for
      `Products`
- [x] 5.2 Creation endpoint (`POST /products`) with category-enum
      validation, `active=true` by default
- [x] 5.3 Update endpoint (`PATCH /products/:id`), including toggling
      `active` (deactivation)
- [x] 5.4 Physical delete endpoint (`DELETE /products/:id`) — a real
      removal of the item, regardless of `active`
- [x] 5.5 Listing endpoint (`GET /products`) with cursor-based
      pagination, the cursor exposed as an encoded opaque token
      (`nextCursor`), never the raw `LastEvaluatedKey`
- [x] 5.6 Category filter via `Query` on the category GSI
- [x] 5.7 Name filter via prefix (`begins_with`), compared against the
      lowercase-normalized name attribute
- [x] 5.8 Support combining the name and category filters at the same
      time
- [x] 5.9 Stable ordering tie-broken by `id`
- [x] 5.10 A Redis read cache (cache-aside, 45s TTL) for the listing,
      falling back directly to DynamoDB if Redis is unavailable
- [x] 5.11 Unit tests for the products module (mocked repository and
      cache)

## 6. Documentation and final tests

- [x] 6.1 Generate OpenAPI documentation (`@nestjs/swagger`) for every
      auth and product endpoint (`@ApiOperation`/`@ApiResponse`,
      request DTOs already auto-documented via `nestjs-zod`)
- [x] 6.2 e2e tests (`supertest`) covering the main flows: register →
      login → refresh → logout, and product CRUD + listing/filters
- [x] 6.3 Integration tests against local LocalStack/DynamoDB and
      local Redis (Docker Compose) — rate-limit (sliding window) and
      the products repository (GSIs, filters, pagination, excluding
      inactive items)
- [x] 6.4 Review `FEAT.md` and the OpenSpec specs in case any
      adjustment was needed during implementation — specs checked
      requirement by requirement against the implementation (everything
      matches); `FEAT.md` section 11 and `design.md` updated with the
      final table modeling (was pending, now resolved)
