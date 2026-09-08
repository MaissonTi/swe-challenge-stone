## Why

The project's documentation is technically accurate (verified across several
prior passes) but not organized for how a reviewer actually reads it: the
main decision-log document (`FEAT.md`) isn't shaped like a PRD despite being
the closest thing this project has to one, the README's "out of scope" list
reads as unfinished work rather than a deliberate boundary for an evaluation
project, there's no explicit acknowledgment of which decisions were shaped
by the challenge's own constraints versus what a real distributed system
would lead to, and four of five architecture diagrams live as binary
Excalidraw files that don't diff or render inline on GitHub. None of this is
a correctness problem — it's a legibility problem for whoever (human or AI)
evaluates this project next.

## What Changes

- **`FEAT.md` → `docs/PRD.md`**, restructured around a recognizable PRD
  skeleton (Overview → Goals/Non-Goals → Requirements → Architecture & Key
  Decisions → Conscious Scope Boundaries → If This Were a Real System →
  Roadmap) while keeping the existing technical decision content — already
  verified accurate in this project's history — as a first-class section,
  not exiled to an appendix. This is a reorganization of existing content,
  not a rewrite of its substance.
- **Every reference to `FEAT.md`** across the repo (docs and code comments)
  updated to `docs/PRD.md`, with section numbers adjusted to match the new
  structure. `openspec/changes/archive/**` (immutable historical record) and
  `docs_to_dev/**` (explicitly off-limits per its own README) are excluded.
- **`README.md`**: the "Fora de escopo desta etapa" section is renamed and
  reframed to state explicitly that this is an evaluation project, that
  avoiding over-engineering here is deliberate, and that a real system
  (especially a distributed one with multiple services) would likely make
  different calls on some of these — with the full version living in
  `docs/PRD.md` and a short pointer in the README.
- **`README.md`**: a new short section highlighting 3-4 "constrained by the
  brief vs. what a real distributed system would lead to" trade-offs (e.g.
  DynamoDB for `Products` vs. a relational store, given the catalog's
  relational/ACID-leaning shape), linking to the full set in `docs/PRD.md`.
- **Diagrams**: the 5 diagrams in `docs/diagrams/*.excalidraw` become 5
  Markdown files with embedded Mermaid (`docs/diagrams/*.md`), one per
  diagram, referenced from `README.md`/`docs/PRD.md`. The current
  `.excalidraw` sources move out of `docs/diagrams/` (into
  `docs/diagrams_OLD/` alongside the existing backups, or removed — decided
  in design.md). `docs/diagrams_OLD/` itself is untouched. Three of the
  five (`auth-flow`, `dynamodb-model`, `rate-limit-sliding-window`) are
  adapted from the equivalent, already-verified Mermaid diagrams in
  `docs_to_dev/{auth,dynamodb,rate-limit}.md` — per the developer's
  explicit, direct authorization to consult that folder's content for this
  change — rather than authored from scratch; the other two
  (`architecture-layers`, `deploy-topology-roadmap`) have no equivalent
  there and are authored fresh.
- **`key_words.md` moves to `docs_to_dev/`.** It stops being a
  public-facing reference doc and becomes a developer-private note, per
  the developer's explicit instruction — it is excluded from the "update
  references" pass in item above and instead relocated, with its own
  `FEAT.md` references corrected to `docs/PRD.md` as part of the move.
- While migrating, the `deploy-topology-roadmap` diagram's known modeling
  error is corrected: DynamoDB and Secrets Manager currently render inside
  the VPC boundary (they're managed AWS services, not VPC-resident
  resources) and the API→DynamoDB connection was lost in a prior manual
  edit. The Mermaid version restores both.
- **Final coherence review**: after implementation, a review pass reads the
  refreshed documentation set as a first-time reader (human or AI) would,
  confirming what was built, why, the trade-offs made, and the next steps
  are all clear without needing this conversation's context.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a documentation reorganization and content-accuracy pass —
no code behavior changes, no API contract changes, no test changes.
`.openspec.yaml` sets `skip_specs: true`.

## Impact

- **Renamed/moved**: `FEAT.md` → `docs/PRD.md`.
- **Rewritten**: `README.md` (two sections renamed/added, diagram
  references updated).
- **New files**: `docs/diagrams/*.md` (5, Mermaid-based).
- **Removed or relocated**: `docs/diagrams/*.excalidraw` (5).
- **Relocated**: `key_words.md` → `docs_to_dev/key_words.md` (no longer a
  public reference doc; its internal `FEAT.md` mentions are corrected to
  `docs/PRD.md` as part of the move).
- **Reference updates only (no behavior change)**: `docs/USO_DE_IA.md`,
  `terraform/README.md`, and code comments in
  `apps/api/src/infra/cache/redis-rate-limiter.ts`,
  `apps/api/src/infra/rate-limit/rate-limit.guard.ts`,
  `apps/api/src/app/usecases/products/list-products.usecase.ts`,
  `apps/api/src/infra/swagger/swagger.config.ts`,
  `apps/api/src/domain/protocols/cache/product-list-cache.interface.ts`,
  `apps/api/test/e2e/auth.e2e-spec.ts`,
  `apps/web/src/lib/refresh-token-storage.ts` (final list confirmed during
  implementation).
- **Untouched by design**: `openspec/changes/archive/**`, `docs_to_dev/**`,
  `docs/diagrams_OLD/**`, all application code behavior, all tests.
- **No new dependencies**: Mermaid renders natively wherever the existing
  Excalidraw files were already viewed (GitHub, VS Code preview), no new
  tooling required.
