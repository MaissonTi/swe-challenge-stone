## Why

The API (auth + product catalog) is complete and has no consumer a human
can use directly — verification so far has been `curl`/`user.http`/Swagger.
A web front-end turns the challenge into a demonstrable end-to-end product
and exercises the API from a real browser client (CORS, token lifecycle,
pagination UX), surfacing integration gaps that a REST client cannot.

## What Changes

- New React SPA (`apps/web`, Vite, no server runtime) covering: sign
  in/sign up, an authenticated product catalog (list, filter by category
  and name prefix, paginate, create/update/deactivate/delete), and a
  profile page.
- Client-side auth: access token held in memory for the app's lifetime,
  refresh token in `localStorage`, an HTTP client that transparently
  retries a request once after a silent refresh on `401`.
- Styling via Tailwind + shadcn/ui (Radix primitives); forms via
  `react-hook-form` with Zod resolvers reusing `packages/common` schemas;
  server state via React Query; routing via React Router (data routers).
- **New API endpoint** `GET /auth/me` so the SPA has something to render
  on the profile page — returns the authenticated user's `userId`,
  `email`, `createdAt`. No new fields on `UserModel`.
- Testing: Vitest + Testing Library for unit/component; Playwright
  end-to-end against the real API via the existing Docker Compose stack
  (no HTTP mocking).

## Capabilities

### New Capabilities
- `web-spa`: the front-end application itself — routing, auth session
  handling in the browser, product catalog UI, profile UI.

### Modified Capabilities
- `user-auth`: adds a requirement for retrieving the authenticated user's
  own profile (`GET /auth/me`). No change to existing login/refresh/
  logout/registration behavior.

## Impact

- New workspace `apps/web` in the Turborepo monorepo; reuses
  `packages/common` (Zod schemas) already shared with `apps/api`.
- `apps/api`: one new protected route (`GET /auth/me`), no changes to
  existing routes, no new dependencies beyond what auth already uses.
- CORS: `apps/api` already calls `app.enableCors()` with no origin
  restriction, which is sufficient for local dev with the new SPA; a
  production-appropriate origin allowlist remains deferred with the rest
  of the deployment/infra work (see `FEAT.md`, "Fora de escopo").
- Known trade-off carried into `design.md`: refresh token in
  `localStorage` is readable by any script that achieves XSS on the page.
  Accepted for this stage in exchange for not requiring API changes to
  cookie-based issuance; documented as a explicit follow-up
  (`httpOnly` cookie) rather than a silent gap.
