## Context

Greenfield build: no auth or product code exists yet in the repository.
Hard constraints from the original challenge (see `proposal.md` - Why):
NodeJS/TypeScript, JWT auth, DynamoDB persistence, Terraform for infra
(deferred to a later change - see Non-Goals). Full rationale and the
conversation history behind every decision below live in `FEAT.md` at the
repo root; this document summarizes the resulting technical approach.

## Goals / Non-Goals

**Goals:**
- Stateless-verifiable authentication (RS256) with a real revocation path
  for logout and theft detection.
- A protected, paginated, filterable product catalog with full CRUD.
- Application-implemented, multi-instance-safe rate limiting.
- Resilience: a secondary dependency (Redis) failing should degrade
  gracefully, not take the API down.
- A repository/port architecture that keeps business logic testable
  without a real database or cache in unit tests.

**Non-Goals:**
- Cloud deployment infrastructure (compute, networking, Terraform) -
  explicitly deferred to a future change.
- Authorization/roles - every authenticated user has equal access.
- Multi-tenancy.
- Full-text/contains search on product name.
- CI/CD pipeline.

## Decisions

**Two independent DynamoDB tables (`Users`, `Products`), not single-table
design.** Single-table design's payoff is avoiding multiple round-trips
when related entities are read together; `Users` and `Products` have no
combined access pattern (no ownership/tenant relationship), and the
original motivation to also hold rate-limit counters in the same table no
longer applies (rate-limit and token blacklist live in Redis). Paying for
single-table's generic key naming and cross-entity key discipline here
would be complexity without a corresponding benefit.

**JWT signed with RS256, not HS256.** Verification only needs the public
key, so any future consumer (or an extracted identity provider) never
needs the signing secret. Same model as Cognito/Auth0/Keycloak.

**Access token: 15 min. Refresh token: 7 days, sliding, single-use with
rotation.** Sliding renewal means an active user is never forced to
re-authenticate; the 15-minute access token TTL bounds exposure
independently of the revocation store being available (see Resilience,
below) - it is a security boundary that does not depend on Redis.

**Refresh token reuse detection with cascading revocation.** Because
rotation invalidates each refresh token after one use, a rotated-out
token being presented again is a strong signal that a copy of it exists
outside the legitimate client (theft). On that signal, every token issued
from that login is revoked, not just the one request denied - this is
the same defense Google and Auth0 use, and comes essentially free given
rotation is already implemented.

**Revocation via Redis blacklist (`blacklist:<jti>`, TTL = token's
remaining validity), not a stateful session store.** JWT's stateless
verification remains the common-case path (signature + expiry only); the
blacklist only needs to be consulted to catch the exception case
(logout, theft detection) - reusing the Redis instance already needed for
rate limiting.

**Password hashing: `argon2id`, `m=19456` KiB, `t=2`, `p=1` (OWASP
baseline).** Chosen over bcrypt for memory-hardness against GPU/ASIC
attacks. The baseline (not OWASP's higher-memory alternative) was chosen
because no infrastructure decision currently constrains available memory
either way; it is the portable default regardless of where compute ends
up running.

**Rate limiting: Redis-backed sliding-window counter, not AWS WAF, not
an in-memory throttler, not a naive fixed-window counter.**
- Rejected in-memory throttling (e.g. default `@nestjs/throttler`):
  breaks under multiple running instances, each with its own counter.
- Rejected delegating to AWS WAF: the challenge asks for an *implemented*
  mechanism, not a delegated one; WAF also only aggregates by raw
  IP/header values, never by decoded JWT claims like `userId`.
- Rejected a naive fixed-window counter: resets abruptly at window
  boundaries, letting a client burst close to 2x the intended limit
  around the reset.
- Rejected an exact sliding-window log (per-request entries in a Redis
  ZSET): more precise, but O(log n) per request and memory that grows
  with request volume, for a precision gain not needed here.
- Chosen: a sliding-window counter (two fixed-window counters, current +
  previous, combined with `estimate = previous * (1 - elapsed_fraction) +
  current`) - O(1) per request via `INCR`/`EXPIRE` in a Lua script for
  atomicity, closely approximating a true sliding window at a fraction of
  the cost. This mirrors how AWS WAF's own rate-based rules behave
  (continuously re-evaluated rolling window, not an abrupt reset) without
  delegating enforcement to WAF itself.

**Rate-limit key: `userId` on authenticated routes, IP on anonymous
routes (e.g. login).** More precise than AWS WAF can achieve natively,
since WAF cannot decode a JWT to key by user identity.

**Fail-open on Redis unavailability, for both rate-limiting and the
blacklist check, with a short timeout (~50-100ms) and an alert log.**
Redis is a secondary defense layer for both concerns; authentication's
primary guarantee (RS256 signature + expiry) does not depend on Redis
being reachable. Failing closed would let an unrelated dependency take
the whole API down. Rejected fail-closed for this reason.

**Product deactivate (`UPDATE`, `active=false`) and delete (`DELETE`,
physical removal) as two distinct operations.** A pure soft-delete-only
model was rejected: physical deletion is a real, explicitly requested
capability, but products already referenced by historical orders need a
way to disappear from the catalog without breaking that history -
deactivation covers that case, deletion is the separate, rarer,
destructive action.

**Product name filter: prefix (`begins_with`) only for v1.**
`contains`/full-text has no native, scalable DynamoDB mechanism - a
`Scan` with `contains()` defeats the purpose of the read-through cache
that exists specifically to protect DynamoDB from expensive reads, and
an external search index (e.g. OpenSearch) is new infrastructure ruled
out of scope for this change. Prefix search requires a lowercased,
normalized name attribute (case-insensitivity) and a fixed-partition-key
GSI (e.g. `"PRODUCT"`) to support prefix search when no category filter
narrows the partition - a known DynamoDB pattern, with the caveat that it
concentrates reads on a single partition at very large catalog scale
(acceptable at this project's scale).

**Product listing cache: Redis cache-aside, TTL 30-60s, no explicit
invalidation on write.** Rejected a version-counter invalidation scheme
(bump a version key on every write, embed it in every cache key) - it
was evaluated as the correct answer *if* the listing could not tolerate
any staleness, but a product catalog can; adding it now would be
complexity without a requirement driving it. Documented as the natural
next step if the freshness requirement ever tightens.

**Pagination: cursor-based, using DynamoDB's `LastEvaluatedKey`
internally but never exposing it raw.** Exposed as an opaque encoded
token (e.g. base64 of JSON) in a `next_cursor` field, following common
REST API practice (GitHub, Stripe). Keeps the public API contract
decoupled from DynamoDB's internal key structure.

**No authorization/roles on product operations.** Any authenticated user
can create, update, deactivate, or delete any product. This is a
deliberate scope decision (no role concept exists anywhere in this
system), not an oversight.

**User enumeration protection.** Login and registration return a generic
error and comparable response timing regardless of whether the submitted
e-mail exists, to avoid leaking account existence to an attacker.

## Risks / Trade-offs

- [Risk] Redis outage degrades rate-limiting and instant token revocation
  (fail-open) → [Mitigation] Short access-token TTL (15 min) bounds
  exposure independent of Redis; failures are logged/alertable.
- [Risk] Sliding-window counter is an approximation, not an exact count
  → [Mitigation] Approximation error is small in practice and an
  accepted trade-off against the cost of an exact log; documented here
  rather than silently assumed.
- [Risk] Cache staleness up to ~60s after a product write →
  [Mitigation] Acceptable for a catalog (not a real-time inventory
  system); version-counter invalidation documented as an escape hatch if
  this requirement changes later.
- [Risk] The fixed-partition-key GSI used for name-only prefix search
  becomes a single hot/large partition as the catalog grows →
  [Mitigation] Acceptable at this project's scale; would need sharding
  or a dedicated search index at real scale.
- [Risk] The `argon2` package's native binding must match the runtime
  OS/architecture → [Mitigation] Build inside the same image/environment
  used to run the app; revisit explicitly once a deployment target is
  chosen (see Non-Goals).
- [Risk] Two independent tables lose whatever convenience single-table
  design would have offered → [Mitigation] Accepted - no combined access
  pattern exists to justify that cost.

## Migration Plan

Greenfield: no existing users or product data to migrate. How the built
artifact is deployed to AWS is explicitly out of scope for this change
(see `proposal.md`).

## Open Questions

- Cloud compute/deployment target and Terraform provisioning - deferred
  to a future change.

### Resolved during implementation

**DynamoDB key schema.** `Users`: partition key `email` (direct lookup on
login, uniqueness enforced via `ConditionExpression` on create); `userId`
is a plain attribute, used only as the JWT claim. `Products`: partition
key `productId`; two GSIs - `byCategoryActive` (`gsi1pk =
${category}#${active}`, sort key `nameSortKey = ${nameLower}#${productId}`)
for category-filtered listing (with or without a name prefix), and
`byActive` (`gsi2pk = ${active}`, same sort key) for listing/name-prefix
filtering with no category. Baking `active` into both partition keys
means excluding inactive products never needs a `FilterExpression` - the
partition queried simply never contains them.
