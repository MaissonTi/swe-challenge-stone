## Why

Today's `400` validation response carries `errors: ZodIssue[]` — the
*raw* Zod issue objects (one entry per violated rule, each repeating
its `path` as an array, plus Zod-internal fields like `code`,
`validation`, `inclusive`, `exact` that mean nothing to a client). A
field with 3 violated rules produces 3 separate array entries instead
of one entry listing all 3 messages, and there's no clean
"all messages for this field" shape a client can render directly.
(Correction: the error-response DTO's own doc-comment claimed `message`
was a flat `string[]` on validation errors — that was already stale;
verified against a live request that `message` stays the constant
string `"Validation failed"` and the per-issue detail lives in
`errors`.) Separately, the password policy allows whitespace
characters, which is a real gap (e.g. a leading/trailing space silently
becomes part of the credential).

## What Changes

- **BREAKING**: change the shape of `errors` in validation-error (400)
  responses from raw `ZodIssue[]` to a per-field grouped array,
  `{ path: string; messages: string[] }[]` — one entry per field, with
  every violated rule's message text and nothing else. `message` stays
  the constant `"Validation failed"` string; non-validation errors
  (404, 401, 429, ...) are untouched (they never carry `errors` at
  all).
- Extend the shared `passwordPolicySchema`
  (`packages/common/src/schemas/auth.schema.ts`) to reject passwords
  containing any whitespace character.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `user-auth`: the Password Policy requirement gains a "no whitespace"
  rule and scenario.

## Impact

- `apps/api/src/main.ts` (custom validation exception handling in place
  of the default `ZodValidationPipe` formatting).
- `apps/api/src/presentation/http/dtos/common/error-response.dto.ts`
  (schema for the grouped shape).
- `packages/common/src/schemas/auth.schema.ts` (password policy).
- `apps/api/openapi.json` (regenerated).
- All e2e specs asserting on `.body.errors` for a 400 response.
- `docs/PRD.md` / `docs_to_dev/` where the current error shape or
  password policy is documented.
- `apps/web` is low-impact: it does not currently parse `errors`
  field-by-field (relies on client-side zod validation + a generic
  toast for server errors).
