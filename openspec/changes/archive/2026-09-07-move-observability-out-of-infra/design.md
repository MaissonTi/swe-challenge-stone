## Context

See proposal.md - Why. `infra/observability/` currently holds 5 files
with two different consumer profiles:

- `trace.decorator.ts` + `trace-span.ts` + `trace-span.interface.ts` —
  consumed by `app/usecases/*` (8 files). This is the pairing that
  creates layering tension.
- `trace-root.decorator.ts` + `tracing-setup.ts` — consumed only by
  `presentation/*.controller.ts` and `main.ts`, which already may
  depend on `infra/` per the existing rule. No tension there.

## Goals / Non-Goals

**Goals:**

- Make `app/usecases` importing tracing utilities a non-exception,
  ordinary case — not something each file has to justify.
- Keep tracing behavior byte-for-byte identical; this is a location and
  documentation change only.

**Non-Goals:**

- Renaming `TraceSpan`, `TracePrefixEnum`, `Trace`, `TraceRoot`, or any
  exported symbol — the names are fine, only their folder's position in
  the layer stack was the problem.
- Changing what gets traced, span naming, or the OpenTelemetry SDK
  setup itself.

## Decisions

**Move the whole `observability/` folder, not just the two files
`app/usecases` needs.** `trace-root.decorator.ts` and
`tracing-setup.ts` don't strictly need to move (their only consumers,
`presentation/` and `main.ts`, already tolerate an `infra/` import) —
but splitting one conceptual unit ("how this app does tracing") across
two locations for a distinction that only matters internally would be
more confusing than the problem it solves. Keeping the 5 files together
under a single `observability/` also makes the "this is a cross-cutting
concern, not a layer" framing legible at a glance from the directory
listing alone.

**New location: `apps/api/src/observability/`, sibling to
`domain/app/infra/presentation`.** Not nested under any of the four —
it's consumed by three of them (`app`, `presentation`, and the
composition root `main.ts`), so nesting it under any single one would
misrepresent who depends on it.

**Update the dependency rule in `docs/PRD.md` §4.1.3 instead of
leaving the carve-out implicit.** The whole point of this change is
that the exception was being re-litigated per file instead of stated
once, structurally. The tree gets a fifth entry; the "Dependency
rule" paragraph names `observability/` explicitly as available
to `app/usecases` and `presentation` alongside their existing
allowances.

**Comment removal, not replacement.** The 8 use cases lose their
exception comment entirely rather than getting a smaller comment
pointing at the new folder - once the import is unremarkable (same
status as `@Injectable()` from `@nestjs/common`), it doesn't need an
inline comment any more than that import does. The one place this
reasoning lives is `docs/PRD.md` §4.1.3.

## Risks / Trade-offs

- [A future contributor might still wonder why `app/usecases` can
  import `observability/` but not `infra/`] → Covered once, in
  `docs/PRD.md` §4.1.3's dependency rule, which is the doc every other
  layering decision in this codebase is already anchored to - not a
  new convention to discover.
- [Pure rename/move changes carry a mechanical risk of a missed import
  path breaking the build] → Mitigated by running the full build +
  lint + type-check + unit + e2e suite after the move, before
  considering this done (see tasks.md).
