## Context

See `proposal.md` — Why. `RateLimitGuard.resolveIdentityKey` (in
`apps/api/src/infra/rate-limit/rate-limit.guard.ts`) already falls back
to `request.ip` for unauthenticated routes; that part of the code is
correct as written. The gap is entirely at bootstrap: Express's `req.ip`
getter only trusts `X-Forwarded-For` when the app has been told to
(`app.set('trust proxy', ...)`), and nothing in this codebase ever calls
that. `apps/api/src/main.ts` currently does:

```ts
const app = await NestFactory.create(AppModule);
```

`NestFactory.create(AppModule)` without a generic type returns a plain
`INestApplication`, which does not expose Express-specific methods like
`.set()` on its own type.

## Goals / Non-Goals

**Goals:**
- Make `request.ip` resolve the real client address when this API is
  deployed behind a trusted reverse proxy, without touching the guard's
  own logic.
- Keep today's behavior byte-for-byte identical when no proxy is
  configured (local dev, current e2e/integration tests, and the actual
  current deployment, which has no load balancer in front of it yet).
- Prove the mechanism actually works with a real test, not just cite
  Express's documentation.

**Non-Goals:**
- Deciding or provisioning any real reverse proxy/load balancer — that
  is the separate, already-tracked compute/network roadmap item.
- Rate-limiting logic changes, threshold changes, or any change to
  authenticated-route keying (`userId`-based keys are unaffected by this
  entirely).
- IPv6-specific normalization or CIDR-based trusted-proxy allowlists —
  Express's numeric hop-count mode is sufficient for the single-hop
  topologies (one ALB, one nginx) this project's roadmap anticipates;
  a CIDR allowlist would only matter for a multi-layer proxy chain,
  which is speculative here.

## Decisions

### Numeric hop count (`TRUST_PROXY_HOPS`), not a boolean or CIDR list

Express's `trust proxy` setting accepts several shapes: `true` (trust
every hop — trivially spoofable by any client that sets its own
`X-Forwarded-For`), a specific IP/CIDR allowlist (precise, but requires
knowing the proxy's address ahead of time — not decided yet, see
Non-Goals), or a number (trust exactly that many hops counted from the
socket backward, ignoring anything beyond). A number is the right fit
here: it doesn't require knowing a real proxy's address before one
exists, it fails safe at `0` (trust nothing, today's actual behavior),
and it maps directly onto "how many reverse proxies sit between the
client and this process" — the one fact whoever provisions compute will
actually know.

### Default `0`, sourced from a new env var, not hardcoded

`TRUST_PROXY_HOPS` defaults to `0` in `envSchema` (`env.ts`) — trust
proxy off, matching the literal current deployment (no proxy exists) and
every current test environment. This is deliberately not a hardcoded
`1` "for when there's eventually an ALB": guessing a topology that
doesn't exist yet would be exactly the kind of premature specificity
this project has avoided elsewhere (e.g., the Terraform IAM role's
neutral trust policy for the same "compute isn't decided yet" reason —
see `docs/PRD.md`, cloud-infra roadmap). Whoever provisions real compute
sets this alongside that decision, in one place, with no code change.

### Configured in `main.ts`, read the same way `PORT` already is

`main.ts` already reads `process.env.PORT` directly rather than through
the DI-resolved env validation, because bootstrap code runs before
`EnvService` would be resolvable in the general case. `TRUST_PROXY_HOPS`
is applied right after `NestFactory.create()` — before `app.listen()`,
so before any request can be routed — and is read the same direct way,
for consistency with the existing bootstrap pattern rather than
introducing a second convention. It is still declared in `envSchema` so
it's validated/coerced and documented alongside every other env var, the
same reasoning already applied to `OTEL_EXPORTER_OTLP_ENDPOINT`.

### `NestFactory.create<NestExpressApplication>(AppModule)`

To call `.set('trust proxy', ...)`, `main.ts` creates the app typed as
`NestExpressApplication` (from `@nestjs/platform-express`, already a
transitive dependency of any default Nest HTTP app) instead of the
untyped `INestApplication`. Alternative considered:
`app.getHttpAdapter().getInstance().set('trust proxy', ...)` on the
existing untyped `app` — works without changing the generic, but reads
as reaching around the framework's own typed API for something Nest
explicitly supports; the typed generic is one line and is the
documented way to do this.

### No change to `rate-limit.guard.ts`

`resolveIdentityKey`'s `request.ip` read is already correct code — it
was only ever fed a value that was correct in one deployment shape
(no proxy) and wrong in another (behind one). Fixing where that value
comes from, rather than adding proxy-aware logic to the guard, keeps
the guard itself simple and keeps this fix in exactly one place.

### Proving it: a real request through a real `trust proxy` setting

An e2e/integration test boots the app (or the relevant test app factory)
with `TRUST_PROXY_HOPS=1`, sends two requests to the same
anonymous-route rate limit (e.g., login) with two different
`X-Forwarded-For` values, and asserts neither is throttled by the
other's count — proving the fix closes the real gap, not just that
Express's docs say it should. A second case with `TRUST_PROXY_HOPS=0`
(or unset) confirms the default keeps today's behavior: `X-Forwarded-For`
is ignored, `request.ip` still comes from the socket.

## Risks / Trade-offs

- **[Risk]** Whoever eventually provisions real compute forgets to set
  `TRUST_PROXY_HOPS` to match the actual topology, silently leaving
  trust proxy off (or wrong) in production.
  → **Mitigation**: documented explicitly in `docs/PRD.md` right next to
  the existing compute/network roadmap entry, framed as a required step
  of that decision rather than a standalone footnote easy to miss.
- **[Risk]** A number-based hop count is coarser than a CIDR allowlist —
  if a client is somehow able to reach the app through exactly the
  trusted number of hops without actually going through the real proxy
  (unlikely in a typical VPC-private-subnet topology, where the app
  isn't directly reachable at all), it could spoof its own
  `X-Forwarded-For`.
  → **Mitigation**: accepted for the single-hop topologies this project
  anticipates (see Non-Goals); the app not being directly internet
  -reachable outside the proxy is the actual control here, same as any
  standard ALB/private-subnet deployment.
- **[Trade-off]** This fix is inert (default `0`) until compute is
  actually provisioned — it closes a real gap in the code without being
  exercisable against a real proxy today.
  → Accepted: the goal is to not ship the gap silently once compute
  *is* decided, not to simulate a proxy that doesn't exist yet. The new
  test exercises the mechanism directly instead.
