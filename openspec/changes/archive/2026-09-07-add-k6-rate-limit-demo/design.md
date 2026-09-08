## Context

See proposal.md - Why. Rate-limit behavior (`RateLimitGuard`,
`RedisRateLimiter`, sliding-window-counter) is already implemented and
specified (`openspec/specs/rate-limit/spec.md`); this only adds a
demo/visualization tool, not new behavior.

## Goals / Non-Goals

**Goals:**

- One command a non-technical viewer can watch run and understand
  (clear counts, clear pass/fail line) against the login route's tight
  limit (5 req/60s), which is fast to demonstrate.

**Non-Goals:**

- Load/performance testing (latency percentiles, throughput) — the user
  narrowed scope to "show the rate-limit working," not a benchmark.
- Testing cache or auth flows under load — dropped from the original
  broader ask per user's explicit scope narrowing.
- CI integration.

## Decisions

**Target route: `POST /v1/auth/login`.** Chosen over the product listing
route because its limit (5/60s) is tight enough to hit in a couple of
seconds of scripted requests, making the demo fast and the `429` obvious
— the default 100/60s route would need a much longer/heavier script to
visibly trip.

**Output format.** k6's default summary is dense; the script uses a
custom `handleSummary` (or simple `console.log` per iteration) to print
a compact table: request #, status code, and (once tripped)
`Retry-After` value — optimized for being read live over someone's
shoulder, not for parsing.

**Location: `k6/` at repo root**, not under `apps/api/`, since it drives
the API as a black box over HTTP and isn't part of either app's own
build/test pipeline.

## Risks / Trade-offs

- [Script assumes login rate-limit stays at 5/60s] → If that
  `@RateLimit` decorator value changes, the demo's iteration count needs
  a matching update; documented as a comment at the top of the script
  pointing at `openspec/specs/rate-limit/spec.md` and the actual
  decorator usage in `auth.controller.ts`.
- [Requires k6 installed locally, an extra tool] → Documented as a
  prerequisite in the `k6/README.md`; this is accepted since it's an
  optional demo script, not part of the required setup path.
