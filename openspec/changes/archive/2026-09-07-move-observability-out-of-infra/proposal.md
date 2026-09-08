## Why

`app/usecases/*.usecase.ts` imports `TraceSpan`/`TracePrefixEnum` from
`infra/observability/`, which conflicts with this project's own
documented layering rule (`docs/PRD.md` §4.1.3: "app/usecases depends
only on interfaces from domain/protocols"). Every one of the 8 use cases
that uses tracing carries a comment explaining this as a deliberate
exception — one full explanation in `login.usecase.ts`, a one-line
pointer back to it in the other 7. The comment is compensating for a
folder placement that doesn't match what the code actually is:
`trace.decorator.ts`/`trace-span.ts` depend only on `@opentelemetry/api`
(the vendor-neutral tracing API, not the SDK/exporter), and are
consumed by every layer (`app/usecases`, `presentation`, `main.ts`) —
the textbook shape of a cross-cutting concern, not a port
implementation the way DynamoDB/Redis/argon2 adapters under `infra/`
are. `@Injectable()` (from `@nestjs/common`) needs no such comment for
the exact same reason: it isn't "infra" either.

## What Changes

- Move `infra/observability/` to a new top-level `observability/`,
  sibling to `domain/app/infra/presentation` — a cross-cutting concern,
  not a layer.
- Update every import path referencing the old location (8 use cases,
  3 controllers, `main.ts`).
- Remove the "deliberate exception" comment from the 8 use cases (the
  full explanation in `login.usecase.ts`, the one-line pointers in the
  other 7) — importing `observability/` no longer needs justifying.
- Update the comment in `infra/env/env.ts` that references the old path
  in prose.
- Update `docs/PRD.md` §4.1.3: add `observability/` to the layer tree
  and restate the dependency rule to name it explicitly instead of
  leaving it as an undocumented per-file exception.

No behavior change: tracing works identically before and after (same
files, same code, only their folder and import paths change).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — no spec-level behavior changes; this is a code/docs
reorganization)

## Impact

- `apps/api/src/infra/observability/*` → `apps/api/src/observability/*`
  (`git mv`, 5 files: `trace.decorator.ts`, `trace-span.ts`,
  `trace-span.interface.ts`, `trace-root.decorator.ts`,
  `tracing-setup.ts`).
- 8 `apps/api/src/app/usecases/**/*.usecase.ts` files (import path +
  comment removal).
- 3 `apps/api/src/presentation/http/controllers/*.controller.ts` files
  and `apps/api/src/main.ts` (import path only).
- `apps/api/src/infra/env/env.ts` (comment text only).
- `docs/PRD.md` §4.1.3.
- Any test file importing from the old `infra/observability/` path.
