## 1. API: `GET /auth/me`

- [x] 1.1 Add `GetProfileUseCase` (`domain`/`app` layers) returning
      `{ userId, email, createdAt }` for the authenticated user, reusing
      `IUserRepository` (added `findById`, backed by a new `byUserId` GSI
      on the Users table — see decision recorded in this session)
- [x] 1.2 Add `GET /auth/me` route to `AuthController` (protected, no
      `@Public()`, no new rate-limit override — default limit applies)
- [x] 1.3 Add response DTO/presenter that excludes `passwordHash`
- [x] 1.4 Unit tests for the use case (found/not-found paths)
- [x] 1.5 e2e test: valid token returns profile; missing/invalid token
      returns 401
- [x] 1.6 Add the request to `user.http`

## 2. Shared schemas (`packages/common`)

- [x] 2.1 Move/add the registration password-policy schema (currently
      only enforced in `apps/api`'s DTO) into `packages/common` so both
      the API DTO and the SPA form import the same schema
- [x] 2.2 Add `createProductSchema`/`updateProductSchema` (or reuse the
      API's existing Zod schemas if already colocated) to
      `packages/common`
- [x] 2.3 Update `apps/api`'s DTOs to import from `packages/common`
      instead of redefining the same rules, if not already doing so
- [x] 2.4 Re-run `apps/api` unit/e2e tests to confirm no behavior change

## 3. `apps/web` workspace scaffold

- [x] 3.1 Scaffold `apps/web` with Vite + React + TypeScript, wired into
      the Turborepo workspace (`package.json`, `tsconfig.json`,
      `turbo.json` pipeline entries for `dev`/`build`/`test`)
- [x] 3.2 Add `packages/common` as a workspace dependency of `apps/web`
- [x] 3.3 Install and configure Tailwind CSS
- [x] 3.4 Install shadcn/ui, generate `components.json`, add the base
      primitives needed (button, input, dialog, table, toast, select,
      form)
- [x] 3.5 Add `.env.example` for `VITE_API_BASE_URL`

## 4. Core app infrastructure

- [x] 4.1 `lib/http-client.ts`: `ky` instance with a `beforeRequest`
      hook injecting the in-memory access token and an `afterResponse`
      hook that on `401` calls `/auth/refresh` once and retries the
      original request once (never retries the refresh call itself)
- [x] 4.2 `providers/AuthProvider.tsx`: holds the in-memory access token
      and current user, persists/reads the refresh token in
      `localStorage`, exposes `signIn`/`signOut`/`refreshSession`
- [x] 4.3 On app bootstrap, if a refresh token exists in `localStorage`,
      attempt a silent refresh before rendering authenticated routes
      (routed through the same deduped `refreshSessionOnce` the 401
      retry hook uses - see bug found during verification, below)
- [x] 4.4 `providers/QueryProvider.tsx`: React Query client setup
- [x] 4.5 `App.tsx`: `createBrowserRouter` with a route guard component
      wrapping authenticated-only routes, redirecting to `/auth/signin`
      when there is no session
- [x] 4.6 `services/auth.service.ts` and `services/products.service.ts`:
      typed wrappers over `http-client` for every API call the SPA needs

## 5. Auth screens

- [x] 5.1 `routes/auth/SignInPage.tsx`: form (react-hook-form + Zod),
      calls `AuthProvider.signIn`, shows the generic error on failure
- [x] 5.2 `routes/auth/SignUpPage.tsx`: form validated against the
      shared password-policy schema, redirects to sign-in on success
- [x] 5.3 Sign-out action (in the authenticated layout's header) calling
      `AuthProvider.signOut`

## 6. Product catalog

- [x] 6.1 `routes/products/ProductsPage.tsx`: paginated listing via
      React Query, category + name-prefix filter controls
- [x] 6.2 Cursor-based "next page" control using the API's opaque cursor
      (no offset/page-number UI, matching the API's pagination model)
- [x] 6.3 `routes/products/ProductFormModal.tsx`: create/update form
      (shared schema from `packages/common`), opened as a modal route
- [x] 6.4 Deactivate action (update with `active: false`) and delete
      action from the listing row, each invalidating the listing query
      on success

## 7. Profile

- [x] 7.1 `routes/profile/ProfilePage.tsx`: fetches `GET /auth/me` via
      React Query and displays e-mail + account creation date

## 8. Styling & layout

- [x] 8.1 `components/layout/AuthLayout.tsx` (public, centered form
      layout) and `components/layout/AppLayout.tsx` (authenticated,
      header + nav + sign-out)
- [x] 8.2 `components/composition/Pagination.tsx`,
      `ProductFilters.tsx`, toast notifications wired to mutation
      success/error

## 9. Testing

- [x] 9.1 Configure Vitest + Testing Library for `apps/web`
- [x] 9.2 Unit tests: `http-client` refresh-and-retry-once logic
      (including the "refresh itself fails" and "never double-retry"
      cases, and the concurrent-refresh dedup that fixed the bug found
      during verification - see design.md)
- [x] 9.3 Component tests: sign-in form validation, product form
      validation (name-required client-side block). The category
      Select's own open/choose interaction needs real `PointerEvent`
      behavior jsdom doesn't reliably provide - that specific scenario
      ("invalid category blocked client-side") is covered by the
      Playwright e2e suite instead (real browser), not skipped
- [x] 9.4 Configure Playwright against the real API (reuse the existing
      Docker Compose stack + seeded users), with a `globalSetup` that
      resets rate-limit counters (mirrors `apps/api`'s own e2e helper -
      needed once real runs revealed the shared login rate limit)
- [x] 9.5 Playwright e2e: sign up → sign in → create product → see it in
      listing → deactivate → confirm it disappears from default listing;
      delete covered on a second product (a deactivated product has no
      reachable row to delete from the active-only listing)
- [x] 9.6 Playwright e2e: expired/invalid session redirects to sign-in

## 10. Documentation

- [x] 10.1 Update root `README.md`: `apps/web` setup/run instructions,
      remove it from the "fora de escopo" list
- [x] 10.2 Update `FEAT.md` with the front-end decisions (stack, session
      storage trade-off, scope)
- [x] 10.3 Update `docs/USO_DE_IA.md` with this change's AI-usage notes,
      consistent with the rest of the project's documentation
