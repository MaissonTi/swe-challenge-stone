## 1. Create `docs/PRD.md`

- [x] 1.1 Create `docs/PRD.md` with the 7-section skeleton (headings only,
      per design.md's mapping table)
- [x] 1.2 Write §1 Overview / Problem (opening paragraph + old §1
      Objective)
- [x] 1.3 Write §2 Goals & Non-Goals (distilled from old §1/§2;
      non-goals point to §5 instead of duplicating it)
- [x] 1.4 Write §3 Requirements (old §2: functional requirements,
      mandatory technical requirements, evaluation criteria — content
      unchanged, just relocated)
- [x] 1.5 Write §4 Architecture and Key Decisions: open with the existing
      "Technical decisions, straight to the point" trade-off table, then
      old §3 (3.1–3.5), §4, §5, §6, §7, §8, §9, §12, §13, §14 (minus its
      "Next steps" subsection) as subsections `4.1`…`4.10`, in the
      same order, renumbered but not rewritten; fold old §11's content
      into the `3.4`-equivalent subsection
- [x] 1.6 Write §5 Deliberate scope decisions (old §10, renamed, with
      the new opening framing: evaluation project, deliberate
      anti-over-engineering, real distributed system would differ on some
      of these)
- [x] 1.7 Write §6 If this were a real system...: DynamoDB vs. relational
      for `Products` (developer's example — note both sides explicitly:
      DynamoDB fits this project's current, stable access pattern well
      per §4's existing rationale, but a richer real-world product domain
      with variants/pricing/supplier relations would tip toward
      relational/ACID), centralized
      identity/introspection vs. per-service token revocation,
      API-Gateway-level rate-limit vs. embedded, event-driven cache
      invalidation vs. synchronous, absence of a message bus, absence of
      idempotency keys on `POST /products`, metrics/log-aggregation gap,
      IAM trust policy placeholder
- [x] 1.8 Write §7 Next steps / roadmap (old §14's "Next
      steps — compute" subsection, standing on its own)
- [x] 1.9 Delete `FEAT.md`

## 2. Fix internal cross-references

- [x] 2.1 Sweep `docs/PRD.md` for every "see section N" / "§N" reference
      and update to the new numbering per design.md's mapping table
      (check the trade-off table's `Ref.` column too) — done inline
      while writing §1–§7 above; verified below with a targeted re-check

## 3. Update external references to `FEAT.md`, relocate `key_words.md`

- [x] 3.1 `README.md`
- [x] 3.2 `docs/USO_DE_IA.md`
- [x] 3.3 `terraform/README.md`
- [x] 3.4 Code comments: `apps/api/src/infra/cache/redis-rate-limiter.ts`,
      `apps/api/src/infra/rate-limit/rate-limit.guard.ts`,
      `apps/api/src/app/usecases/products/list-products.usecase.ts`,
      `apps/api/src/infra/swagger/swagger.config.ts`,
      `apps/api/src/domain/protocols/cache/product-list-cache.interface.ts`,
      `apps/api/test/e2e/auth.e2e-spec.ts`,
      `apps/web/src/lib/refresh-token-storage.ts`
- [x] 3.5 `git mv key_words.md docs_to_dev/key_words.md`; fix its internal
      `FEAT.md` mentions to point at `docs/PRD.md` (new section numbers
      per the mapping table) — per the developer's explicit instruction,
      this file is no longer a public reference doc
- [x] 3.6 Repo-wide `grep -rn "FEAT\.md"` — fixed `apps/api/openapi.json`
      (regenerated via `npm run generate:openapi`, was stale after the
      `swagger.config.ts` string change). Remaining matches are all
      legitimate: other OpenSpec changes' own planning artifacts
      (historical, treated like `archive/**`), this change's own
      proposal/design/tasks (describing the migration itself), and one
      intentional historical mention in `docs/USO_DE_IA.md` ("previously
      FEAT.md, at the root")

## 4. `README.md` updates

- [x] 4.1 Rename "Out of scope for this stage" → reframed section (short
      version in README, full version in `docs/PRD.md` §5, linked)
- [x] 4.2 Add a "Decision and trade-off summary" section: 3-4 highlights
      (leading with DynamoDB vs. relational for `Products`), linking to
      `docs/PRD.md` §6 for the full list
- [x] 4.3 Update the diagram list to point at the new
      `docs/diagrams/*.md` files instead of `*.excalidraw`

## 5. Diagrams: Excalidraw → Markdown + Mermaid

- [x] 5.1 `docs/diagrams/architecture-layers.md` (`flowchart TD`, layer
      boxes + dependency arrows)
- [x] 5.2 `docs/diagrams/auth-flow.md` (`flowchart TD` with decision
      nodes; adapted from `docs_to_dev/auth.md`'s existing diagrams;
      tightened the label to "Valid credentials?"; also carried over
      the 4-scenario sequence diagram for the Redis/blacklist
      interactions)
- [x] 5.3 `docs/diagrams/dynamodb-model.md` (`flowchart TD`, not
      `erDiagram`; adapted from `docs_to_dev/dynamodb.md`'s "table and
      index structure" + index-decision diagrams — both tables +
      all 3 GSIs, including `byUserId`)
- [x] 5.4 `docs/diagrams/rate-limit-sliding-window.md` (`flowchart TD`;
      adapted from `docs_to_dev/rate-limit.md`'s guard-decision +
      calculation diagrams)
- [x] 5.5 `docs/diagrams/deploy-topology-roadmap.md` (`flowchart TD` with
      a `subgraph` VPC boundary; DynamoDB/Secrets Manager drawn outside
      it, API→DynamoDB arrow restored, provisioned-vs-roadmap labels
      restored — rendered to PNG and visually verified, not just
      assumed correct)
- [x] 5.6 Moved the 5 `.excalidraw` files out of `docs/diagrams/` into
      `docs/diagrams_OLD/` (suffixed `-v2` since `docs/diagrams_OLD/`
      already held same-named files from an earlier backup; neither set
      was touched/overwritten)
- [x] 5.7 (not originally listed, done for consistency) All 8 Mermaid
      code blocks across the 5 files rendered successfully via
      `@mermaid-js/mermaid-cli` (`mmdc`) — syntax verified, not assumed

## 6. Final verification

- [x] 6.1 `grep -rn "FEAT\.md"` repo-wide returns zero matches outside
      `openspec/changes/archive/**` and `docs_to_dev/**` — confirmed
      clean; also caught and fixed a stale `apps/api/openapi.json`
      (regenerated) that the original task list didn't anticipate
- [x] 6.2 Confirmed via `git status` that `openspec/changes/archive/**`
      has zero changes, and that the pre-existing files in
      `docs_to_dev/` and `docs/diagrams_OLD/` were not edited (only
      `docs_to_dev/key_words.md`, explicitly authorized, and new
      `-v2`-suffixed additions to `docs/diagrams_OLD/`)
- [x] 6.3 Final coherence review (design.md's 5-point checklist): read
      `README.md` fully fresh and checked `docs/PRD.md`'s heading
      structure/cross-references systematically — a first-time reader
      can tell what was built, why, the trade-offs, and the next steps;
      no orphaned section references; roadmap (§7) clearly distinguished
      from what's implemented (§4); `grep` confirms no stray `FEAT.md`;
      all 5 diagrams render (verified via `mmdc`) and the
      `deploy-topology-roadmap` fix was visually confirmed, not assumed
