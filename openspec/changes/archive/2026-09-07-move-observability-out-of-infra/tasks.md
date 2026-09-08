## 1. Move the folder

- [x] 1.1 `git mv apps/api/src/infra/observability apps/api/src/observability`

## 2. Update imports

- [x] 2.1 Update the 8 `app/usecases/**/*.usecase.ts` files: import path
      from `../../../infra/observability/...` to
      `../../../observability/...`
- [x] 2.2 Update the 3 `presentation/http/controllers/*.controller.ts`
      files and `main.ts`: import path from
      `../../../infra/observability/...` / `./infra/observability/...`
      to the new location
- [x] 2.3 Update `apps/api/test/unit/presentation/http/controllers/trace-root-coverage.spec.ts`
      (and any other test referencing the old path)
- [x] 2.4 (not in the original plan) 5 files *inside* `infra/` also
      import `TraceSpan` with a relative path that never spelled out
      `infra/` (e.g. `infra/cache/redis-rate-limiter.ts` imported
      `../observability/trace.decorator`) — invisible to a grep for the
      literal string `infra/observability`, so missed until
      `type-check` failed with 5 `Cannot find module` errors. Fixed:
      `infra/cache/*.ts` (3 files) `../observability` → `../../observability`;
      `infra/database/dynamodb/repositories/*.ts` (2 files)
      `../../../observability` → `../../../../observability`

## 3. Remove the exception comments

- [x] 3.1 Remove the full "deliberate exception" comment block from
      `login.usecase.ts`
- [x] 3.2 Remove the one-line pointer comment
      (`// Ver login.usecase.ts para o motivo...`) — only 2 of the
      other use cases actually had it (`logout.usecase.ts`,
      `refresh-token.usecase.ts`); the remaining 5 never repeated it

## 4. Docs

- [x] 4.1 Update `apps/api/src/infra/env/env.ts`'s comment referencing
      the old `infra/observability/tracing-setup.ts` path
- [x] 4.2 Update `docs/PRD.md` §4.1.3: add `observability/` to the
      layer tree, restate the "Dependency rule" paragraph to name
      it explicitly

## 5. Verification

- [x] 5.1 `grep -r "infra/observability"` across `apps/api/src` and
      `apps/api/test` returns nothing
- [x] 5.2 Run `npm run build`, `npm run lint`, `npm run type-check` for
      `apps/api` and confirm they pass — required task 2.4 (see above)
      before this went green
- [x] 5.3 Run the full unit + e2e suite for `apps/api` and confirm
      nothing broke — 120/120 unit, 21/21 e2e
- [x] 5.4 Start the app locally and confirm a trace still appears in
      Jaeger with the same span structure as before (controller → use
      case → repository) — confirmed: `AuthController.register` →
      `usecase.RegisterUserUseCase.execute` →
      `repository.DynamoDbUserRepository.create`, same as before the
      move. (The running `nest start --watch` process needed a manual
      restart — its incremental build cache got confused by `git mv`
      relocating a directory it was watching; a fresh `npm run dev`
      picked up the new layout cleanly.)
