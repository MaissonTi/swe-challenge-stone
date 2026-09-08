# AI usage on this project

Tool: **Claude Code** (CLI), model **Claude Sonnet 5** (Anthropic).
Used from start to finish — from architecture exploration to
implementation, tests, and documentation. This document describes
**how** it was used, not just that it was, including the points where
the developer disagreed, corrected course, or caught mistakes the AI
itself made.

## Methodology

The project followed a structured three-phase flow, via **OpenSpec**
(a spec-driven development tool used through Claude Code):

### 1. Exploration (`/opsx:explore`)

Before any code, an exploration session discussed trade-off by
trade-off: RS256 vs HS256, where to keep the rate-limit counter (Redis
vs DynamoDB vs delegating to AWS WAF), cursor-based vs offset
pagination, `argon2id` parameters, DynamoDB table modeling, compute
(Lambda vs EC2), and more. The outcome of that phase is recorded in
[`docs/PRD.md`](./PRD.md) — every decision there carries its rationale
and the alternatives discarded.

**The developer stepped in directly on technical decisions at several
points** — not just accepting whatever the AI proposed on the first
try. Concrete examples of this appear throughout this document (see
the front-end and observability sections below).

### 2. Formalizing into specs (OpenSpec)

The exploration's decisions became formal artifacts before any line of
code:

- `proposal.md` — why the change exists, what it changes, which
  capabilities
- `design.md` — technical decisions with alternatives considered and
  risks
- `specs/*.md` — testable requirements in `SHALL`/`WHEN`/`THEN` format
  for the 3 capabilities (`user-auth`, `products`, `rate-limit`)
- `tasks.md` — implementation checklist (38 items, in 6 groups)

These artifacts live in
[`openspec/changes/archive/2026-09-05-add-auth-and-products-api/`](../openspec/changes/archive/2026-09-05-add-auth-and-products-api/).

### 3. Task-driven implementation (`/opsx:apply`)

Each of the 38 tasks was implemented, tested, and marked complete
before moving to the next. No task was marked `[x]` without real
validation against the local stack (Docker Compose with LocalStack and
Redis) — never just "write the code and assume it works."

## Code decisions that came from the developer's direct questions

Organizing `apps/api/src/` into layers (Clean Architecture —
`domain/app/infra/presentation`, see `docs/PRD.md` §4.1.3) avoids
mixing infrastructure with business logic inside the same folder — a
decision discussed directly with the developer, not accepted at face
value without pushback. Other code decisions that came from the same
kind of direct question, not spontaneous AI suggestion:

- The `interface` (behavioral contract) vs `type` (plain data)
  distinction
- The `I` prefix on every interface under `domain/protocols/`, not
  just on use cases
- Centralizing domain errors under `domain/errors/`
- Reorganizing tests out of `src/` (`test/unit`, `test/mocks`,
  `test/integration`, `test/e2e`)
- Where the shared package lives (`packages/common` vs `apps/common`)
  — decided, reverted, and decided again after discussing the real
  reason behind Turborepo's `apps/` vs `packages/` convention

## Bugs found through verification, not by accident

Because every task required validation against the real stack before
being marked complete, two real integration bugs were found and fixed
**before** reaching an end user:

1. `packages/common/package.json` pointed `main`/`types` at the
   TypeScript source instead of the compiled build — it worked
   everywhere (tests, `tsc`) because nothing at real runtime had
   reached that import yet; it only broke once the products module
   entered the graph of the actually-running application.
2. The e2e/integration tests created the application without going
   through `main.ts`, so `dotenv` (environment variables) and the
   global `ZodValidationPipe` were never applied there — tests passed
   by mistake in scenarios that should have failed (e.g. a weak
   password being accepted).

And, with the same transparency, two bugs in the **AI's own
hand-written tests** (not production code) were also found by running
everything against the real stack:

3. An `ExecutionContext` mock returned a new function on every call,
   making an assertion fail on reference inequality.
4. A "tampered JWT" test altered the signature's last character —
   which is sometimes a base64url padding bit with no effect on the
   decoded value, making the test occasionally invalid.

## Tests and verification

Nothing was considered "done" just because it compiled. Every feature
was actually exercised. Current state of the API (the numbers grow
with each change — the per-phase sections below cite the count as of
that phase):

- **119 unit tests** (mocked dependencies)
- **11 integration tests** (real DynamoDB and Redis via Docker Compose)
- **16 e2e tests** (real HTTP requests via supertest)
- Statement coverage raised from 38% to ~83% after an audit the
  developer specifically requested on this point
- Manual tests via `curl` and via [`user.http`](../user.http) during
  development, including attack scenarios (refresh-token reuse,
  rate-limit overflow) to confirm the defense actually engages

## Documentation and diagrams

- [`docs/PRD.md`](./PRD.md): kept as a living record of decisions
  throughout the whole conversation, not written all at once upfront
- [`README.md`](../README.md): written after the implementation was
  complete, as a natural consequence of the project already working
  end to end
- `docs/diagrams/*.md`: five Mermaid diagrams embedded in Markdown —
  render directly on GitHub/VS Code, no extra extension, and diff as
  text. They cover: the layered architecture, the auth flow, the
  DynamoDB modeling, the sliding-window rate-limit calculation, and
  the target deploy topology (roadmap). Generated by the AI from the
  code and the decisions already documented in the PRD.

In the `deploy-topology-roadmap` diagram, the AI identified and fixed
a modeling defect before considering it done: DynamoDB and Secrets
Manager were drawn inside the VPC boundary — architecturally
incorrect, since they're managed AWS services, not VPC-resident
resources — and the API→DynamoDB arrow was missing.

## Front-end (`add-web-spa` change)

The same three-phase flow (exploration → OpenSpec → `/opsx:apply`) was
repeated for the front-end, after the API had already been archived.

**Exploration:** the developer pasted a folder-structure template that
was clearly Next.js App Router (`middleware.ts`, file-based routes,
`@modal`, an intercepting route, `app/api/auth/[...nextauth]`) while
asking for an SPA — not Next.js. The AI named that tension directly
instead of trying to force-fit both, separated what survives in an SPA
(`components/`, `providers/`, `lib/http-service` → `lib/http-client`)
from what has no equivalent (file-based routing, Server Actions,
NextAuth), and proactively raised a product decision the original
request didn't cover:
where to keep the refresh token in the browser (localStorage vs an
`httpOnly` cookie), since that potentially meant reopening the already
archived `user-auth` spec. The developer decided: localStorage for
simplicity now, with the XSS trade-off documented and a cookie
recorded as a future step — exactly the same deliberate-decision
pattern already used elsewhere in the project (e.g. cache TTL vs a
version counter).

**Scope discovery during formalization:** while writing the Profile
requirement's spec, the AI noticed `GET /auth/me` didn't exist and
that `IUserRepository` could only look up by e-mail — the JWT only
carries `userId`. Instead of deciding on its own, it stopped and asked
the developer: add a `byUserId` GSI to the `Users` table (without
changing the token) or embed the e-mail as an extra claim in the JWT
(without changing the table). The developer chose the GSI.

**Real bugs found through manual verification, before any automated
test was written** — the same discipline used on the API was applied
here: nothing was considered done just because it compiled/built.

1. **A named import from `packages/common` broke Vite's build**
   (`"loginSchema" is not exported by .../dist/index.js`): the package
   compiles to CommonJS (`export *` becomes a runtime `__exportStar`
   loop); the front-end's bundler (Rollup) can't statically see the
   names exported through that pattern, even after switching to an
   explicit named re-export. Resolved by pointing a Vite alias at
   `packages/common/src` (the TypeScript source), which Vite already
   transpiles the same way it does the front-end's own code — without
   touching the CommonJS build the API needs.
2. **The session silently dropped minutes after a successful login**:
   the bootstrap effect (silent refresh on page reload) called refresh
   directly. Since React 18's `StrictMode` runs effects twice in dev,
   two concurrent calls used the same (single-use) refresh token — the
   second looked like reuse of an already-rotated token to the API,
   triggering cascading revocation by design (see `specs/user-auth`).
   Fixed by routing the bootstrap through the same refresh dedup
   (`refreshSessionOnce`) the 401 HTTP interceptor already used. Found
   by running the actual application in a browser via Playwright, not
   in a unit test.
3. **False positive in a diagnostic script**: a newly created product
   "disappeared" from the listing in some manual tests. Investigation
   traced it to an already-documented characteristic (not a bug): the
   listing caches for up to 45s without invalidating on write
   (`docs/PRD.md`, §4.4). The verification criterion was adjusted
   (filter by a name never queried before, forcing a real cache miss)
   instead of "fixing" behavior that was already intentional.
4. **Test-environment limitation recorded with transparency:** the
   category Select (Radix) doesn't reliably open via
   `userEvent`/`fireEvent` under jsdom (missing real `PointerEvent`
   support) — after trying the usual workarounds (`PointerEvent`
   polyfills, `hasPointerCapture`, `setPointerCapture`), the AI didn't
   push for a fragile fix: this specific scenario was covered by
   Playwright (a real browser) instead of Vitest, with the decision
   and reason documented in `design.md` and `tasks.md`, not silenced.

**The e2e suite was flaky on repeated runs**: running the Playwright
suite in sequence (or right after manual tests) made login return a
generic error instead of authenticating — not an application bug, it
was the login rate limit itself (5/60s, by design) being exhausted by
the test's repetitions. Resolved with a `globalSetup` that clears the
Redis counters before the suite, the same pattern the API's own e2e
tests already used.

## Observability (`add-tracing-observability` change)

A different starting point than the two previous phases: the developer
pasted the code for a ready-made tracing kit from another project of
theirs (an order-matching service), asking to add OpenTelemetry +
Jaeger by reusing that code, "feel free to change where the folder
lives."

**Adapt instead of just relocating.** The AI read all 5 files of the
original kit (not just what was pasted into the message) before
proposing anything, and directly named what didn't make sense to bring
over as-is: a Datadog-agent configuration branch unrelated to this
project, business baggage (`orderId`/`orderType`/`orderPair`) from a
domain entirely different from Users/Products, and a decorator
(`TraceParent`) that only exists to continue a trace coming from a
queue — this project has no queue. Instead of copying and leaving dead
code behind, each piece was justified individually: what stays, what
goes, and why.

**The AI identified a real conflict with an already-established rule,
and stopped to ask instead of deciding on its own.** Applying the
tracing decorator on `app/usecases/*.usecase.ts` would be the first
time a concrete use case imported `infra/` directly — breaking a
previously spotless discipline (only `usecases.module.ts` touches
`infra/`, and only for DI wiring). The AI presented three paths (skip
the use-case span, build a real `ITracer` port, or accept a documented
exception) with each one's trade-off, without pushing toward any
particular side. The developer chose the documented exception.

**Another decision the AI brought to the table without being asked:**
keeping the manual `@TraceSpan()` decorator instead of using
`instrumentation-aws-sdk`/`-ioredis` (auto-instrumentation packages)
was an explicit question, not a silent choice — with the trade-off
comparison (rich automatic attributes vs. monkey-patch-free control)
laid out before asking. The developer confirmed the no-auto-
instrumentation direction.

**Real verification, not assumed — again.** After decorating every use
case/repository/adapter, the AI ran the 96-test unit suite (without
changing any of them) to confirm the decorator is truly a no-op
outside an active trace - it wasn't enough for the behavior to "look"
correct from reading the code. Then, with Docker Compose and the API
actually running, it fired real requests and queried Jaeger's API
directly (not just looked at the UI) to confirm the expected span
tree, the absence of `user.id` on a public route, and — by shutting
down the Jaeger container — that requests kept responding in
milliseconds without blocking. All three verifications became a
permanent part of `tasks.md`, with the real span names observed, not a
generic "should work" restatement.

**A side effect of the session, not of the code:** while starting the
API for manual verification, the AI found two old `nest start --watch`
processes still running (one of them left over from an earlier step of
this same session, forgotten in the background), fighting over port
3000. It diagnosed with `ps`/`lsof` before killing anything, instead of
assuming the `EADDRINUSE` error was a bug in the freshly written code.

## Observability refinement + SPA fixes (`refine-observability-and-web-fixes` change)

A correction session over the previous phases, triggered by four
observations the developer raised in explore mode: remove
`HttpInstrumentation` and put the root-span decorator directly on the
controller; sweep the `observability/` files for dead code; migrate
the front-end's HTTP client from `ky` to `axios`; and two SPA bugs — a
created/deleted product not appearing/disappearing from the listing.

**Explore before proposing.** The AI mapped the whole tracing stack
before suggesting a change: it showed the root span was already opened
by `TracingInterceptor` (not by `HttpInstrumentation`, which only added
a redundant HTTP span) and that removing the auto-instrumentation
eliminated, as a bonus, the import-order constraint in `main.ts`. It
also traced the SPA bug to its real cause: the front-end already
invalidated the React Query cache correctly - it was the API serving
stale data, whose Redis listing cache (45s TTL) was never invalidated
on write.

**Explicitly reversing a recorded decision.** `add-tracing-observability`
had decided "root span via a global interceptor, not a per-controller
decorator." The AI flagged that the requested change reversed that
decision, recorded why in the new change's `design.md`, and covered
the risk the interceptor used to prevent (a new route with no trace)
with a guard test that sweeps every handler on every controller.

**Only one capability actually changes.** Of the four threads, three
are refactors with no observable effect (the decorator, dead code,
`axios`) and got no spec delta; only the cache invalidation changed a
real requirement (`products` → "Read-Path Caching"), with new
scenarios for create/update/delete reflecting immediately and for an
invalidation failure not taking the write down with it.

**Honest verification of the environment's limits.** The API's build +
118 unit tests and the front-end's unit tests passed and were run. The
two steps that need the full stack — checking the span tree in Jaeger
and the Playwright e2e suite — were left marked as pending execution
by the developer, not assumed done.

## Summary

The AI generated most of this project's code, tests, and
documentation, but under a process with explicit decision gates: no
architecture choice was applied without a trade-off discussion, the
developer actively intervened on several decisions (reverting,
redirecting, or asking for a review), and no implementation was
considered complete without real validation against the local
infrastructure — including the front-end, verified end to end in a
real browser against the running API, and observability, verified
against a real Jaeger, not just against mocks.
