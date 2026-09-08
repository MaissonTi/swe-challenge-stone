## Context

See `proposal.md` — Why. `FEAT.md` today has 14 numbered sections plus two
unnumbered lead-in sections ("Decision summary", "Technical decisions,
straight to the point") — all verified accurate across several prior passes in
this project's history (including removing two unsupported "original
decision reversed" narratives). This design reorganizes that content into
a PRD-shaped `docs/PRD.md`; it does not rewrite the technical substance.

A sibling change, `refine-docs-diagrams-and-openapi`, already landed
(`/v1` prefix, `axios` wording, the `byUserId` GSI fix in
`dynamodb-model.excalidraw`, `openapi.json`, `key_words.md` fixes). This
design builds on that state, not the state before it.

## Goals / Non-Goals

**Goals:**
- `docs/PRD.md` reads as a PRD (recognizable Overview → Goals → Requirements
  → Architecture/Decisions → Scope → Roadmap skeleton) while keeping 100%
  of the existing decision rationale, just reorganized and renumbered.
- Every reference to `FEAT.md` anywhere in the repo (docs and code
  comments) is updated to `docs/PRD.md` with the correct new section
  number — no dangling old-path or old-number references.
- The 5 current diagrams exist as Mermaid + Markdown, at least as accurate
  as their Excalidraw predecessors, with the one known modeling defect
  (`deploy-topology-roadmap`'s DynamoDB/Secrets Manager inside the VPC
  boundary, missing API→DynamoDB arrow) corrected.
- A final review confirms the documentation set is legible to a reader
  with none of this conversation's context.

**Non-Goals:**
- Rewriting the technical content itself — this is a structure/organization
  pass. A sentence may be split, reworded for flow, or given a new heading;
  it may not change what it claims technically.
- Touching `openspec/changes/archive/**`, `docs_to_dev/**`, or
  `docs/diagrams_OLD/**` — all three are explicitly out of scope (archive
  is an immutable historical record; `docs_to_dev/` says its own content
  must be ignored by AI and not used as reference; `diagrams_OLD/` is a
  deliberate backup).
- Any code behavior change. Nothing here touches `apps/api/src` or
  `apps/web/src` logic — only comments that cite `FEAT.md` by name.

## Decisions

### Section mapping: old `FEAT.md` → new `docs/PRD.md`

The new document keeps the old subsection structure nested under fewer,
PRD-shaped top-level headings, rather than flattening or rewriting it —
this is what keeps the reorg low-risk. Old section numbers below refer to
the current `FEAT.md`; every "see section N" cross-reference in the document
(there are many) gets updated per this table:

| New `docs/PRD.md` section | Old `FEAT.md` source |
| --- | --- |
| 1. Overview / Problem | Opening paragraph + old §1 (Objective) |
| 2. Goals & Non-Goals | Distilled from old §1/§2's functional scope; non-goals cross-reference new §5 instead of duplicating it |
| 3. Requirements | Old §2 (Scope of the original brief: functional requirements, mandatory technical requirements, evaluation criteria) |
| 4. Architecture and Key Decisions | The "Technical decisions, straight to the point" trade-off table (kept prominent, opens the section) + old §3 (3.1–3.5), §4 (Stack), §5 (Rate-limit), §6 (Cache), §7 (Monorepo), §8 (Auth), §9 (Product), §12 (Front-end), §13 (Observability), §14 (Terraform, minus its "Next steps" subsection) — kept as `4.1`…`4.10` subsections in the same order, renumbered but not rewritten. Old §11's content (Users/Products table modeling — now settled, not open) folds into the `3.4`-equivalent subsection instead of standing alone. |
| 5. Deliberate scope decisions | Old §10 (Out of scope for this stage), renamed and given the new opening framing (evaluation project, deliberate anti-over-engineering, real distributed system would differ on some of these) |
| 6. If this were a real system... | New section — the trade-off list from the exploration session (DynamoDB vs. relational for `Products`, centralized identity/introspection vs. per-service revocation, API-Gateway-level rate-limit, event-driven cache invalidation, no message bus, no idempotency keys, metrics/log aggregation gap, IAM trust policy) |
| 7. Next steps / roadmap | Old §14's "Next steps — compute" subsection, moved out to stand on its own |

The "Decision summary (quick read)" lead-in either becomes the
opening of §1 or is dropped in favor of the PRD's own Overview — decided
during implementation based on how much it overlaps once §1–§3 exist;
either way nothing it says is lost, since every point in it is also in the
detailed sections.

### Reference sweep is mechanical, verified by re-grep

Every non-excluded file that mentions `FEAT.md` (`README.md`,
`docs/USO_DE_IA.md`, `terraform/README.md`, and the seven code-comment
locations named in the proposal) gets its path updated to `docs/PRD.md`
and, where it cites a specific section number, the number updated per the
mapping table above. After editing, `grep -rn "FEAT\.md"` across the repo
must return zero matches outside `openspec/changes/archive/**` and
`docs_to_dev/**` (which will hold `key_words.md`, see below) — this is a
task, not just an intention.

### `key_words.md` relocates to `docs_to_dev/`, per direct instruction

The developer decided `key_words.md` should stop being a public reference
doc and become a developer-private note, moving it to `docs_to_dev/`
alongside `auth.md`/`dynamodb.md`/`rate-limit.md`. It is excluded from the
reference-sweep list above; instead, `git mv key_words.md
docs_to_dev/key_words.md`, with its own internal `FEAT.md` mentions
corrected to `docs/PRD.md` as part of the move (a private note pointing at
a deleted file is still worth fixing, even though it's no longer
public-facing). No other file currently links to `key_words.md` by name
(checked: neither `README.md` nor `docs/USO_DE_IA.md` reference it), so
the move has no other ripple effect.

### `docs_to_dev/` consulted for diagram accuracy, per direct instruction

The developer explicitly authorized reading `docs_to_dev/{auth,dynamodb,
rate-limit}.md` to inform decisions in other files for this change — the
exception `docs_to_dev/README.md` itself reserves for an "explicit,
direct request from the developer." Those three files already contain
verified, code-accurate Mermaid flowcharts and sequence diagrams covering
almost exactly the same ground as `auth-flow.md`, `dynamodb-model.md`, and
`rate-limit-sliding-window.md` (task group 5) — reusing/adapting that
content is lower-risk than authoring equivalent diagrams from scratch.
This does **not** change the earlier decision to leave `docs_to_dev/`
itself untouched and unlinked from public docs: content is adapted into
the new public files, but nothing in `docs/` or `README.md` references or
quotes `docs_to_dev/` directly, and `docs_to_dev/`'s own files are not
edited by this change (except the incoming `key_words.md` relocation
above, which the developer separately, explicitly requested).

Also relevant: `docs_to_dev/dynamodb.md`'s "Why DynamoDB, and not
MongoDB/MySQL/Postgres" section argues DynamoDB fits *this project's
current, stable access pattern* well (category/prefix filtering, no
joins). That's not in tension with the new PRD §6 (a *hypothetical* real
system with a richer product domain — variants, pricing tiers, supplier
relations — leaning relational/ACID) — both points are true at different
scales, and §6 should say so explicitly rather than reading as
contradicting §4's existing DynamoDB rationale.

### Diagram type per Mermaid file

- **`architecture-layers.md`**: `flowchart TD` — one box per layer
  (`presentation`/`app/usecases`/`domain`/`infra`), arrows labeled
  "depends on" / "implements", matching the existing dependency rule.
- **`auth-flow.md`**: `flowchart TD` with decision nodes (Mermaid's
  diamond `{...}` shape) for "valid credentials?" and "was the refresh
  already used before?" — adapted from `docs_to_dev/auth.md`'s existing
  verified diagrams (its 4 small flowcharts collapse into one cohesive
  flow matching the current Excalidraw's scope: register → login →
  refresh rotation → reuse detection → logout), including tightening the
  first diamond's label (today "does the password match?", which
  undersells that a nonexistent user takes the same branch as a wrong
  password — both already reach the same generic 401 in
  `login.usecase.ts`, and `docs_to_dev/auth.md` doesn't have this
  imprecision to begin with).
- **`dynamodb-model.md`**: `flowchart TD`, not `erDiagram` — DynamoDB has
  no relational foreign keys between `Users` and `Products`, so an ER
  diagram would imply a relationship that doesn't exist. Adapted from
  `docs_to_dev/dynamodb.md`'s "table and index structure" flowchart
  (already exactly this: boxes per table + GSI, `active` embedded in the
  GSI partition keys, `byUserId` included).
- **`rate-limit-sliding-window.md`**: `flowchart TD` — adapted from
  `docs_to_dev/rate-limit.md`'s "calculation diagram" (previous/current
  window boxes feeding a weighted estimate, decision node branching to
  `429` or "allow"), with the fixed-window/sliding-log rejection
  rationale as a note, matching the current Excalidraw's scope.
- **`deploy-topology-roadmap.md`**: `flowchart TD` using a Mermaid
  `subgraph` for the VPC boundary, containing only the load balancer and
  the API. `DynamoDB` and `Secrets Manager` are drawn **outside** the
  subgraph (correcting the current defect), each with an arrow back to the
  API box ("via IAM role, already provisioned" / "reads at boot"), and each
  labeled with its actual provisioning state ("already provisioned via
  Terraform" vs. "to be provisioned") — the distinction the Excalidraw version
  lost in a manual edit.

### Old `.excalidraw` files move to `docs/diagrams_OLD/`, not deleted

Consistent with how `docs/diagrams_OLD/` already holds a prior backup of
the same 5 files (made ahead of this change). Moving rather than deleting
keeps the pre-Mermaid versions recoverable with zero extra process; a
`README.md` note in `docs/diagrams_OLD/` isn't required since the folder's
purpose is already self-evident from its name and existing contents.

### Final coherence review: concrete checklist, not a vibe check

Run as the last task, reading `README.md`, `docs/PRD.md`,
`docs/USO_DE_IA.md`, and the 5 new diagram files fresh, checking:

1. A reader with none of this project's conversation history can tell
   what was built, why, and what wasn't, from the docs alone.
2. Every claim in `docs/PRD.md` is still traceable to its rationale (no
   orphaned "see section N" left pointing at the old numbering).
3. Roadmap/next-steps items (§7) are clearly distinguished from what's
   already implemented (§4) — no ambiguity about what's done vs. planned.
4. `grep -rn "FEAT\.md"` outside the two excluded paths returns nothing.
5. Each Mermaid diagram renders (checked via the Excalidraw/Markdown
   preview available in this environment) and matches the corresponding
   code/table it documents.

## Risks / Trade-offs

- **[Risk]** Renumbering sections while preserving ~30 internal
  cross-references ("see section N") is mechanical but error-prone if done
  ad hoc.
  → **Mitigation**: the mapping table above is the single source of truth
  for old→new numbers; tasks.md includes a dedicated re-grep-and-fix-
  cross-references step, not folded silently into the rewrite step.
- **[Risk]** Moving prose between sections reintroduces an inaccuracy
  (this document's history already has two precedents: unsupported
  "hexagonal"/"single-table" narratives caught and removed).
  → **Mitigation**: the reorg step is explicitly restricted to
  moving/renumbering + connective sentences, never restating a technical
  claim in new words; the final coherence review re-checks this
  specifically for the sections that moved the most (old §3, §10, §14).
- **[Risk]** A `FEAT.md` reference is missed in a file the proposal's list
  didn't anticipate.
  → **Mitigation**: the re-grep check in the coherence review is
  repo-wide, not scoped to the proposal's known list.
- **[Trade-off]** `docs_to_dev/`'s content stays isolated from the new
  public docs with no cross-link in either direction, so some rationale
  may end up duplicated (once privately, once publicly) with no pointer
  between them.
  → Accepted — explicit decision from the exploration session, per that
  folder's own README.

## Migration Plan

Purely additive/renaming — no runtime behavior, no data, no deployed
artifact is affected. Rollback is `git revert` of the change's commit(s);
nothing outside the documentation tree and code comments is touched, so
there is no partial-migration state to worry about beyond finishing the
reference sweep before considering any task done.
