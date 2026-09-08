## Context

See `proposal.md` - Why. `apps/api` and `packages/common` already exist
(Turborepo monorepo); `packages/common` holds Zod schemas (e.g.
`ProductCategory`) shared with the API and available to reuse here. The
API issues `accessToken`/`refreshToken` as a JSON body on login/refresh
(RS256, 15 min / 7 day sliding), revocable via a Redis-backed blacklist,
with single-use refresh rotation and reuse-detection cascading
revocation — this design treats that contract as fixed and adapts the
client to it rather than proposing API changes, except for the one new
endpoint the proposal calls out (`GET /auth/me`).

## Goals / Non-Goals

**Goals:**
- A working SPA that exercises 100% of the existing API's authenticated
  surface (auth lifecycle + product CRUD/listing) plus the new profile
  endpoint.
- A session model that survives page reload without forcing a fresh
  login, and that fails safely (logs the user out) when the API
  signals the session is no longer valid.
- Reuse `packages/common` Zod schemas for client-side validation so
  validation rules cannot drift between API and UI.

**Non-Goals:**
- Server-side rendering, or any Next.js-style file-based routing
  conventions — this is a pure client-rendered SPA.
- Cookie-based (`httpOnly`) refresh token storage — evaluated and
  deferred (see Decisions and Risks below).
- Deployment/hosting of the SPA (S3+CloudFront or otherwise) and
  production CORS hardening — deferred with the rest of the
  infrastructure work (`FEAT.md`, "Fora de escopo").
- Any admin/user-management screen — the API has no such surface.

## Decisions

### Build tool & routing: Vite + React Router (data routers)
The user's reference structure was Next.js App Router (`middleware.ts`,
file-based routing, parallel/intercepting routes, Server Actions,
`app/api/.../route.ts`). None of that applies to a pure SPA with no
server runtime — Vite (no framework routing conventions to fight) plus
React Router's data routers (`loader`/`action`, nested routes) is the
direct SPA equivalent, and its "modal route" pattern replaces the
reference's `@modal`/intercepting-route trick for the create/edit
product form.

### Session storage split: access token in memory, refresh in `localStorage` (Option A)
Considered three options (full comparison already covered in
exploration): plain `localStorage` for both tokens; access-in-memory +
refresh-in-`localStorage`; refresh in an `httpOnly` cookie set by the
API. Chose the middle ground:
- Access token (used on every authenticated request) never touches
  persistent storage, so it doesn't survive an XSS payload that runs
  after the fact or a reload — it must always be re-derived from a
  refresh.
- Refresh token in `localStorage` is still readable by injected script
  while it runs, which is the accepted trade-off (see Risks).
- Avoids changing how the API issues tokens (`Set-Cookie`, `SameSite`,
  CORS-with-credentials) for this stage. Full `httpOnly` cookie storage
  is the natural next step if this ships beyond the challenge context.

### HTTP client: `ky` with a single 401-triggered refresh-and-retry interceptor
`ky`'s hook API (`beforeRetry`/`afterResponse`) maps directly onto
"catch 401 → call `/auth/refresh` once → retry the original request
once → if refresh itself fails, clear session and redirect." A guard
against infinite retry loops is required: only ever retry once per
original request, and never retry the refresh call itself.

### Forms & validation: `react-hook-form` + Zod resolver on shared schemas
`packages/common` already exports `productCategorySchema`; this design
adds the request-shape schemas the API's DTOs already define (registration
password policy, product create/update) to `packages/common` so both
`apps/api`'s DTOs and `apps/web`'s forms validate against the same
source, instead of the SPA re-encoding rules like the password policy
regex a second time.

### Styling: Tailwind + shadcn/ui
Matches the reference structure's intent (`components/ui` as a set of
Radix-based primitives) without pulling in a component library with its
own opinionated theming system. shadcn/ui components are copied into the
repo (not an npm dependency), so they live under `apps/web/src/components/ui`
and can be adapted freely.

### Server state: React Query; auth state: a single `AuthProvider` context
Product listing/mutations go through React Query (cache, retry,
invalidation-on-mutation for the catalog). Auth session (current access
token, current user, sign-in/sign-out functions) is small, changes
rarely, and is better served by a plain context than by routing it
through the query cache.

### Folder structure (adapted from the user's reference, SPA-shaped)
```
apps/web/src/
  main.tsx · App.tsx (BrowserRouter/createBrowserRouter)
  routes/{auth/{SignInPage,SignUpPage}, products/{ProductsPage,ProductFormModal}, profile/ProfilePage}
  components/{ui, composition, layout}
  providers/{AuthProvider, QueryProvider, ThemeProvider}
  lib/{http-client, utils}
  hooks/{use-toast, use-auth, use-media-query}
  services/{auth.service, products.service}
  types/
```
Dropped from the reference (no SPA equivalent): `middleware.ts`, the
entire `app/` file-based routing tree (route groups, `@modal` parallel
slot, `(.)users/[...form]` intercepting route, `[[...uuid]]` catch-all),
`app/api/auth/[...nextauth]/route.ts` + NextAuth, `actions/` (Server
Actions), `__home__/` routing-escape convention.

### Testing: Vitest + Testing Library (unit/component); Playwright against the real API (e2e)
Matches the backend's own philosophy in this project (verify against the
real local stack, not assumptions) — e2e runs against `apps/api` over
the existing Docker Compose stack rather than mocking HTTP, so a
contract drift between the SPA and the real API surfaces as a failing
test instead of a false green from a stale mock.

### Profile lookup: `byUserId` GSI on the Users table
Discovered during implementation, not anticipated in this document: the
Users table's only key is `email`, but `GET /auth/me` only has the JWT's
`sub` (`userId`) to look up from. Two options were weighed against the
user directly: add a GSI keyed on `userId` (mirrors the pattern already
used for Products' two GSIs), or embed `email` as an extra JWT claim and
reuse the existing `findByEmail`. Chose the GSI — it adds a lookup path
without changing what every future access token carries, keeping token
payload shape stable regardless of how the profile feature evolves.
`IUserRepository.findById` was added as the corresponding port method.

## Risks / Trade-offs

- **[Risk]** Refresh token in `localStorage` is exposed to any script
  that achieves XSS on the page → **Mitigation**: kept out of scope for
  this stage per explicit product decision; documented here and in
  `proposal.md` as a deliberate, revisable trade-off, not an oversight.
  React's default JSX escaping plus avoiding `dangerouslySetInnerHTML`
  materially reduces the practical XSS surface in the meantime.
- **[Risk]** Naive 401-retry logic could loop forever if the refreshed
  token is itself rejected → **Mitigation**: retry budget of exactly one
  attempt per original request, enforced in the `ky` hook, and the
  refresh call itself is never retried.
- **[Risk]** `GET /auth/me` is a new authenticated route added to
  `apps/api` outside the already-archived `user-auth` change →
  **Mitigation**: implemented as a strict additive change (new route,
  same guard/revocation-check pattern every other protected route
  already uses) with no modification to existing login/refresh/logout
  behavior; covered by the `MODIFIED` delta in `specs/user-auth/spec.md`
  and synced into the main spec like any other requirement.
- **[Risk]** CORS is currently open (`app.enableCors()` with no origin
  restriction) → **Mitigation**: acceptable for local dev against the
  new SPA; production hardening is explicitly deferred with the rest of
  the infra work, not silently ignored.

## Bug found during verification

Manual end-to-end verification against the real API (Docker Compose)
caught a real bug before it reached the task list's own Playwright suite:
`AuthProvider`'s bootstrap effect originally called `authService.refresh`
directly. React 18 StrictMode invokes effects twice in development, so
two concurrent refresh calls fired with the same (not-yet-rotated)
refresh token; the loser's response looked like reuse of an
already-rotated token to the API, which correctly (per
`specs/user-auth`: "Refresh Token Reuse Detection") treated it as theft
and revoked the whole token family - so every reload silently logged the
user back out seconds after the bootstrap "succeeded". Fixed by routing
the bootstrap refresh through the same `refreshSessionOnce` in-flight-
dedup used by the 401 retry hook, so only one actual `/auth/refresh`
call is ever made regardless of how many callers ask concurrently.

Separately, manual verification also confirmed (not a bug, but worth
recording since it looked like one at first) that the products listing
can serve a page from *before* a just-made write for up to the cache's
45s staleness window - exactly as `specs/products` ("Read-Path Caching")
already specifies. A UI check for "does my new/updated product show up"
needs either a filter combination the cache has not already served, or
to tolerate that window - it is not a client-side bug to chase.

## Migration Plan

Purely additive — no existing data, routes, or clients to migrate.
Deploy order: add `GET /auth/me` to `apps/api` first (independently
testable/deployable), then bring up `apps/web` against it. No rollback
complexity beyond removing the new route and/or not deploying the SPA.
