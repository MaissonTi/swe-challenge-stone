## Why

Local setup takes 8 manual steps in the README, `user.http` duplicates what
Swagger already serves, there is no formatting/type-check tooling beyond
per-app ESLint, and the seed data (an interviewer-specific account, 8
products) does not exercise pagination or look realistic in the web UI.
None of this changes API behavior — it is entirely developer/reviewer
experience.

## What Changes

- Add `scripts/setup.sh` (repo root) that bundles key generation (if
  missing), `.env` bootstrapping for both apps (if missing), `docker
compose up -d`, a wait-for-healthy check, `bootstrap:localstack`, and
  `seed` into one command. README's "Como rodar localmente" shrinks from
  8 steps to `npm install` → `./scripts/setup.sh` → `npm run dev`.
- Remove `user.http`; replace the README's "Testar manualmente" section
  with a pointer to the already-existing Swagger UI (`/docs`).
- Add Prettier (`singleQuote: true`, otherwise defaults) plus
  `eslint-config-prettier` to each app; add `format` / `format:check`
  npm scripts and a `type-check` script (`tsc --noEmit`) per app, wired
  into `turbo.json`. Existing `.eslintrc.js` files are left as-is (no
  flat-config migration — out of scope).
- Rework `apps/api/scripts/seed.ts`: drop the
  `entrevistador@stone.com.br` account (keep only `demo@stone.com.br`),
  and generate ~50 products via a per-category name template instead of
  8 hand-written ones.
- Document the Prometheus/Grafana observability gap as an explicit
  roadmap item in `docs/PRD.md` §7 (it already exists as a trade-off
  note in §6; add it to the forward-looking roadmap list too).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — no spec-level requirement changes; this is tooling, scripts, and
docs)

## Impact

- `scripts/setup.sh` (new), `README.md`, `user.http` (removed).
- `apps/api/scripts/seed.ts`.
- `apps/api/package.json`, `apps/web/package.json`, root `package.json`,
  `turbo.json`, new `.prettierrc`/`.prettierignore`.
- `docs/PRD.md` §7.
- No changes to controllers, use cases, DTOs, or any HTTP contract.
