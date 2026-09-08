## Context

See proposal.md - Why. Today, `main.ts` installs `nestjs-zod`'s stock
`ZodValidationPipe` globally, which on failure uses the library's
default `createZodValidationException`, producing
`{ statusCode: 400, message: "Validation failed", errors: error.errors }`
— `error.errors` is `ZodIssue[]` straight from Zod: one entry per
violated rule, each with its own `path` array plus Zod-internal fields
(`code`, `validation`, `inclusive`, `exact`, ...) that carry no meaning
for a client. `error-response.dto.ts`'s doc-comment describes a
different (and wrong) shape — a flat `message: string[]` — which never
matched the actual runtime behavior; confirmed by hitting a live
endpoint. `passwordPolicySchema` (`packages/common`) has no whitespace
rule.

## Goals / Non-Goals

**Goals:**

- Group validation messages by field (`path`) into one entry per field
  with a plain `messages: string[]`, stripped of Zod-internal noise,
  without touching `message` (stays the constant `"Validation failed"`)
  or any non-validation error shape.
- Add the whitespace rule to the single shared password schema so
  `apps/api` and `apps/web` can't drift.

**Non-Goals:**

- Redesigning the error envelope beyond the `errors` shape (no new
  top-level fields, no error codes).
- Retrofitting `apps/web` to render field-level errors from the server
  response — it already validates client-side with the same shared zod
  schema, so server-side field errors are a fallback path, not the
  primary UX; out of scope to add new UI for it now.

## Decisions

**Reshape the existing `errors` field, don't rename or move it.**
`errorResponseSchema.errors` changes from `unknown[]` (previously
undocumented/untyped, holding raw `ZodIssue[]`) to
`{ path: string; messages: string[] }[]`, optional (only present on
validation errors). `message` is untouched. This is a smaller change
than it first looked — the grouped shape lives in the field that
already existed for this exact purpose, just cleaned up.

**Grouping implementation: custom pipe replacing `nestjs-zod`'s
default.** `nestjs-zod`'s `ZodValidationPipe` accepts a
`createZodValidationPipe({ createValidationException })` factory. Use
that to build a `BadRequestException` whose response body groups
`ZodError.issues` by `issue.path.join('.')` into
`{ path, messages: string[] }` entries, keeping `message: "Validation
failed"`. Non-Zod exceptions (404 from a use case, 401 from the JWT
guard, 429 from the rate limiter) never go through this pipe, so they
never carry `errors` at all — no separate exception filter needed.

**Whitespace rule: reject, don't strip.** `passwordPolicySchema` adds
`.regex(/^\S+$/, '...')` (rejects if the value contains any whitespace)
rather than silently trimming — a password the user believes they set
should never be silently transformed; if it contains a space, that's a
data-entry mistake worth surfacing at submission time, not a formatting
detail to fix for them.

## Risks / Trade-offs

- [BREAKING for any existing consumer of the old raw-`ZodIssue[]`
  shape] → There are no external consumers yet (pre-launch challenge
  project); the one internal consumer (`apps/web`) doesn't parse
  `errors` field-by-field today, so nothing there needs to change.
  Documented as **BREAKING** in the proposal for visibility regardless.
- [`path: ""` for schema-level (non-field) Zod issues, e.g. a
  `.refine()` on the whole object] → Falls back to `path: "_root"`
  rather than an empty string, so grouping still makes sense; call out
  that all current schemas only have field-level rules, so this edge
  case has no active example today.
