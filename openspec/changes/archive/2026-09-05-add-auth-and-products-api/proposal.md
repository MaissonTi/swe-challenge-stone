## Why

The technical challenge requires an API with secure login (JWT) and a
protected, paginated product-listing route, with a rate-limit
mechanism **implemented** (not delegated to a managed service) to
handle high request volume. None of these capabilities exist in the
repository today — this change builds the complete functional
foundation (auth + products + rate-limit) on top of which the cloud
infrastructure will be built at a later stage.

## What Changes

- User registration (public endpoint + seed/fixture for dev) and
  login with e-mail/password, with a password policy (minimum 8
  characters, uppercase, lowercase, and a number) and `argon2id`
  hashing.
- Issuing a pair of JWT tokens signed with RS256: an access token (15
  min) and a rotating, sliding refresh token (7 days), with reuse
  detection (cascading revocation of the whole token family on
  suspected theft).
- Logout and immediate token revocation via a Redis blacklist (key
  `blacklist:<jti>`, TTL = the token's remaining validity).
- User-enumeration protection: login/registration responses don't
  reveal whether an e-mail exists in the database.
- Full product CRUD (create, edit, list, delete), with `category` as
  an enum, filtering by name (prefix) and category (combinable),
  paginated listing (opaque cursor), and stable ordering.
- Product deactivation (`UPDATE` with `active=false`, hidden from the
  listing) as a distinct operation from deletion (`DELETE`, physical
  removal).
- A Redis read cache (short TTL) in front of DynamoDB for the product
  listing.
- Distributed rate-limit applied to auth and product routes: a Redis
  counter with a sliding-window-counter algorithm, keyed by `userId`
  (authenticated routes) or IP (anonymous routes), a `429` +
  `Retry-After` response when the limit is exceeded.
- Resilience: the rate-limit and blacklist guards operate in
  *fail-open* mode (with a short timeout) if Redis becomes
  unavailable — RS256-signature authentication keeps working
  regardless.
- Data modeling: two independent DynamoDB tables (`Users` and
  `Products`), no single-table design — the two entities have no
  combined access pattern.

**Out of scope for this change** (see
`openspec/changes/add-auth-and-products-api/design.md` and the
project root's `FEAT.md` for the full rationale): cloud deployment
infrastructure (compute, network, Terraform), CI/CD, DAX, name search
with `contains`/full-text, and AWS WAF as a complementary edge layer.

## Capabilities

### New Capabilities

- `user-auth`: registration, login, JWT (RS256) token
  issuance/renewal/revocation, revocation blacklist, password policy,
  user-enumeration protection.
- `products`: product catalog — CRUD, paginated and filterable
  listing, deactivation vs. physical deletion, stable ordering, read
  cache.
- `rate-limit`: distributed request limiting (Redis, sliding window
  counter), applied per route, with resilience to Redis failure.

### Modified Capabilities

_None — greenfield project, no existing specs to modify._

## Impact

- **New layered organization** inside `apps/api/src/`: `domain/`
  (models and interfaces, no framework dependency), `app/usecases/`
  (business logic: authentication, user, products), `infra/`
  (concrete implementations: DynamoDB, Redis, JWT, argon2), and
  `presentation/` (controllers, DTOs, and HTTP presenters) — see
  `FEAT.md` section 3.3 for the full rationale.
- **New DynamoDB tables**: `Users`, `Products` (exact key/GSI modeling
  still pending — see `tasks.md`).
- **New local infrastructure dependency**: Redis (rate-limit, token
  blacklist, listing cache) and local DynamoDB, via Docker
  Compose/LocalStack.
- **New API surface**: `POST /auth/register`, `POST /auth/login`,
  `POST /auth/refresh`, `POST /auth/logout`, `GET/POST/PATCH/DELETE
  /products`.
- **No impact on AWS/Terraform infrastructure** — deliberately out of
  scope for this change.
