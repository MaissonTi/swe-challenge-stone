## Why

`RateLimitGuard` keys anonymous requests (login, register) by
`request.ip`. Express's `req.ip` resolves from the raw socket address
unless Express is told to trust a reverse proxy (`app.set('trust
proxy', ...)`), which this API never configures. Behind any real
reverse proxy or load balancer — the exact kind of compute this
project's own roadmap (`docs/PRD.md`, cloud infra roadmap section)
already anticipates adding — every anonymous request would resolve to
the proxy's own address instead of the real client's, collapsing all
anonymous traffic through that proxy into a single rate-limit bucket.
For the login route specifically, that means one client hitting the
limit locks out every other client behind the same proxy - the opposite
of what the limit exists to protect. This was found during a docs
review (`docs_to_dev/analise-dos-problemas.md`) and confirmed directly
against `rate-limit.guard.ts` and `main.ts` (no `trust proxy`
configuration exists anywhere in the codebase).

## What Changes

- New env var `TRUST_PROXY_HOPS` (validated in `env.ts`, default `0`):
  the number of reverse-proxy hops Express should trust when resolving
  `req.ip` from `X-Forwarded-For`. Default `0` means "trust no proxy" -
  identical to today's actual behavior, correct for local dev and for
  the current real deployment (no load balancer is provisioned yet;
  compute/network remain an open roadmap item).
- `main.ts` reads this value and calls `app.set('trust proxy', ...)`
  right after creating the Nest application, before it starts routing.
- No change to `rate-limit.guard.ts` itself: Express's `req.ip` already
  resolves correctly from `X-Forwarded-For` once `trust proxy` is
  configured, so `resolveIdentityKey`'s existing `request.ip` read
  starts working correctly for free once the hop count is set.
- Documentation: `docs/PRD.md` (rate-limit section) and
  `apps/api/.env.example` gain an explicit note that `TRUST_PROXY_HOPS`
  must be set to the real hop count once compute/network topology is
  decided - tying this fix directly to the already-documented,
  not-yet-implemented compute roadmap instead of guessing a topology
  that doesn't exist yet.
- A new e2e/integration test proving the mechanism: with
  `TRUST_PROXY_HOPS` set to a nonzero value, two requests carrying
  different `X-Forwarded-For` values against the same rate-limited
  anonymous route get independent buckets rather than colliding.

**Out of scope:** choosing or provisioning any actual reverse proxy or
load balancer - that remains the deferred compute/network decision this
change's documentation explicitly points back to.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `rate-limit`: the existing "Per-Identity Rate Limit Key" requirement
  gains a scenario clarifying that IP-based keying must resolve the
  real client address when the application is deployed behind a
  trusted reverse proxy, not the proxy's own address.

## Impact

- `apps/api/src/infra/env/env.ts`: new `TRUST_PROXY_HOPS` var.
- `apps/api/src/main.ts`: `app.set('trust proxy', ...)` at bootstrap
  (requires creating the app as `NestExpressApplication` to expose
  `.set()`, or calling it via `app.getHttpAdapter().getInstance()`).
- `apps/api/test/e2e/helpers/create-test-app.ts` (or wherever the e2e
  app factory lives): needs to apply the same `trust proxy` setup so
  the new test can configure it per-test.
- `apps/api/.env.example`, `docs/PRD.md`: documentation only.
- No change to `rate-limit.guard.ts`, no change to any response shape,
  status code, or existing rate-limit threshold. Default behavior
  (hops = 0) is identical to today for every current environment
  (local dev, CI, e2e) — this is additive and off by default.
