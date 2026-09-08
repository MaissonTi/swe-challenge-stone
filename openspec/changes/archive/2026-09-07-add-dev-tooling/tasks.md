## 1. Setup script

- [x] 1.1 Create `scripts/setup.sh`: generate RS256 keys if missing, copy
      `.env.example` → `.env` for `apps/api` and `apps/web` if missing,
      `docker compose up -d`, wait for LocalStack/Redis healthy, run
      `bootstrap:localstack`, run `seed` (each step's own output visible,
      `set -euo pipefail`)
- [x] 1.2 Update README's "Como rodar localmente" to the shortened flow
      (`npm install` → `./scripts/setup.sh` → `npm run dev`)

## 2. Remove user.http, point to Swagger

- [x] 2.1 Delete `user.http`
- [x] 2.2 Replace README's "Testar manualmente" bullet with a pointer to
      the Swagger UI (`/docs`)

## 3. Prettier + type-check

- [x] 3.1 Add Prettier (`singleQuote: true`, defaults otherwise) +
      `.prettierrc` + `.prettierignore` at repo root
- [x] 3.2 Add `eslint-config-prettier` to `apps/api/.eslintrc.js` and
      `apps/web/.eslintrc.cjs` `extends` arrays (last entry)
- [x] 3.3 Add `format` / `format:check` scripts to `apps/api`,
      `apps/web` and `packages/common` `package.json`, delegated to via
      `turbo run format`/`format:check` from the root
- [x] 3.4 Add `type-check` script to `apps/api`, `apps/web` and
      `packages/common` `package.json`
- [x] 3.5 Wire `format`, `format:check`, `type-check` into `turbo.json`
      pipeline
- [x] 3.6 Run `prettier --write` and confirm the diff is expected —
      scoped to `apps/*/{src,test,scripts}` and `packages/*/src` only,
      **not** repo-wide (`prettier --write .` also touched
      `package-lock.json`, Playwright's `test-results/`, every archived
      OpenSpec change, and `.claude/` config — reverted and re-scoped;
      see design.md)

## 4. Seed data

- [x] 4.1 Remove `entrevistador@stone.com.br` from
      `apps/api/scripts/seed.ts`, keep only `demo@stone.com.br`
- [x] 4.2 Replace the 8 hand-written products with a generator producing
      ~50 unique, realistic-looking names across the existing categories
- [x] 4.3 Update README references to the interviewer account (credentials
      list, any other mention) — already gone as part of task 1.2's
      README rewrite; verified no other mentions exist

## 5. Docs

- [x] 5.1 Add the Prometheus/Grafana observability gap to `docs/PRD.md`
      §7 (Next steps / roadmap) — it already exists as a §6
      trade-off note; add it to the roadmap list too

## 6. Verification

- [x] 6.1 Run `./scripts/setup.sh` from a clean state (stack down, no
      `.env`, no keys) and confirm it reaches a working API + seeded data
      — ran from a fully clean state (removed `.env`, keys, `docker
      compose down`); reached 50 seeded products + `demo` user with no
      manual intervention
- [x] 6.2 Run `npm run lint`, `npm run format:check`, `npm run type-check`
      (or per-workspace equivalents) and confirm they pass — `turbo run
      lint format:check type-check`: 9/9 tasks pass (lint shows only
      pre-existing `no-explicit-any` warnings in test files, 0 errors)
- [x] 6.3 Run the full unit + e2e suite (`apps/api`) and confirm nothing
      broke from the seed script changes — 119/119 unit tests pass,
      18/18 e2e tests pass
