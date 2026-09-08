## Context

See proposal.md - Why. Current state: `.eslintrc.js` (ESLint 8, per app),
no Prettier, no `type-check` script, `docker-compose.yml` has
`localstack`/`redis`/`jaeger` services, seed script writes 2 users / 8
products directly via `PutCommand`.

## Goals / Non-Goals

**Goals:**

- Cut the manual local-setup steps without hiding what happens (the
  script should be readable/inspectable, not a black box).
- Add formatting/type-check tooling that matches the codebase's existing
  style (avoid a mass-reformat diff).
- Make seed data look realistic enough to demo pagination/filtering.

**Non-Goals:**

- Migrating ESLint to flat config.
- Adding CI (no `.github/` exists yet; out of scope for this change).
- Adding git hooks (husky/lint-staged) — not requested.

## Decisions

**`scripts/setup.sh` scope.** Bundles: key generation (skip if
`apps/api/keys/private.pem` exists), `.env` copy for both apps (skip if
target exists), `docker compose up -d`, a poll loop against LocalStack's
health endpoint and Redis `PING` before continuing, `bootstrap:localstack`,
`seed`. `npm install` and `npm run dev` stay as separate, visible steps —
a reviewer should still see those happen, and re-running `npm install`
inside the script would be surprising if they already ran it.

**Prettier config.** `singleQuote: true`, everything else default
(printWidth 80, trailingComma "all", semi true). An initial spot-check
(`main.ts`, `app.module.ts`) suggested a near-empty diff; running it
repo-wide showed otherwise — many existing lines exceed 80 columns and
get wrapped, so the actual first-run diff touches most `.ts`/`.tsx`
files in `apps/*/src`, `apps/*/test`, `apps/*/scripts`, and
`packages/*/src`, purely re-wrapping (no logic changes). Accepted as a
one-time cost of introducing Prettier to a previously unformatted
codebase.

**Prettier scope: source only, not repo-wide.** `format`/`format:check`
target `apps/*/{src,test,scripts}/**/*.{ts,tsx}` and
`packages/*/src/**/*.ts` explicitly, not `.`. A first attempt at
`prettier --write .` also reformatted `package-lock.json`, Playwright's
`test-results/.last-run.json`, every archived OpenSpec change under
`openspec/changes/archive/` (which must stay frozen as historical
record), and even `.claude/` tooling config — none of that is source
code Prettier should own. Scoping the glob to only the four source
roots avoids needing to enumerate everything else in `.prettierignore`.
`eslint-config-prettier` added last in each `extends` array to disable
stylistic rules that would otherwise conflict.

**`type-check` script.** `tsc --noEmit -p tsconfig.json` per app. Kept
separate from `build` (which already type-checks as a side effect) so it
can be run standalone/faster during development.

**Seed data generation.** Products generated from a small per-category
pool of adjectives/model-name fragments (e.g. ELECTRONICS: "Notebook",
"Fone de Ouvido", "Mouse", "Teclado", "Monitor" × variants) combined
programmatically to reach ~50 unique names, rather than either 50
hand-written names (tedious, hard to keep varied) or fully generic
`Produto N` placeholders (looks bad in the product list/pagination demo,
which was the whole point of increasing the count).

## Risks / Trade-offs

- [`scripts/setup.sh` masks individual failures behind one command] →
  Each step's output stays visible (no output redirection to `/dev/null`);
  the script `set -euo pipefail`s so it stops at the first failure with
  that step's own error message intact.
- [Removing `user.http` removes a zero-dependency way to test without
  installing k6 or clicking through Swagger] → Swagger already covers
  every route `user.http` covered (with try-it-out), so nothing is
  actually lost, per the user's explicit confirmation to rely on Swagger.
