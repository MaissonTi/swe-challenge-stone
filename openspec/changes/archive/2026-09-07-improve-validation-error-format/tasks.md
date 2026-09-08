## 1. Password policy

- [x] 1.1 Add whitespace rejection to `passwordPolicySchema`
      (`packages/common/src/schemas/auth.schema.ts`)
- [x] 1.2 Add/update tests covering the rule — no standalone schema unit
      test exists for `passwordPolicySchema` (no test runner is even
      configured in `packages/common`); the policy is exercised via
      `apps/api`'s register e2e test, following that existing
      convention, with a new case for a whitespace-containing password

## 2. Grouped validation error shape

- [x] 2.1 Update `errorResponseSchema`
      (`apps/api/src/presentation/http/dtos/common/error-response.dto.ts`)
      so `errors` is `{ path, messages }[]` (was untyped/undocumented,
      holding raw `ZodIssue[]` at runtime) — `message` unchanged
- [x] 2.2 Replace the global `ZodValidationPipe` in `main.ts` (and in
      `test/e2e/helpers/create-test-app.ts`, which keeps its own copy of
      the same global-pipe setup) with a custom one
      (`infra/validation/zod-validation-pipe.ts`, built via
      `createZodValidationPipe({ createValidationException })`) that
      groups `ZodError.issues` by `path` into the new `errors` shape
- [x] 2.3 Confirm non-Zod exceptions (404, 401, 429) are unaffected —
      verified live: `GET /v1/auth/me` without a token still returns
      `{ statusCode: 401, message: "Unauthorized" }`, no `errors` field

## 3. Tests and docs

- [x] 3.1 Update every e2e spec asserting on a 400 body shape to the new
      grouped `errors` format — none existed beyond status-code checks;
      nothing to migrate
- [x] 3.2 Add an e2e test covering multiple simultaneous violations
      (e.g. invalid email + weak password) asserting both `path` groups
      appear, including that 3 violations on one field collapse into one
      group with 3 messages instead of 3 separate entries
- [x] 3.3 Regenerate `apps/api/openapi.json`
      (`npm run generate:openapi --workspace=apps/api`)
- [x] 3.4 Update any doc mentioning the old error shape or the password
      policy rules — `docs/PRD.md` (2 mentions of the password policy
      updated to include "no whitespace"); `docs_to_dev/auth.md`
      doesn't document the password policy (only the token
      blacklist/revocation mechanism), so nothing to change there

## 4. Verification

- [x] 4.1 Run the full unit + e2e suite and confirm it passes with the
      new shape — 119/119 unit, 20/20 e2e (16 pre-existing + 1 trust-proxy
      + 3 new from this change)
- [x] 4.2 Manually hit a validation-erroring route and confirm the
      response matches the documented grouped shape — confirmed live via
      `curl` against the running dev server: multi-field payload returns
      `errors: [{path, messages}]` grouped exactly as designed, and a
      3-rule password violation collapses into one group of 3 messages
