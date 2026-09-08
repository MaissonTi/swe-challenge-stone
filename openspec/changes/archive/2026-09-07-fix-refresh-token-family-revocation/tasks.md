## 1. Fix

- [x] 1.1 In `refresh-token.usecase.ts`, replace
      `isTokenBlacklisted(payload.jti)` with
      `isRevoked(payload.jti, payload.familyId)`

## 2. Tests

- [x] 2.1 Update the mock revocation store usage in
      `refresh-token.usecase.spec.ts` to mock `isRevoked` (alongside
      the existing `isTokenBlacklisted`, still used by other tests) and
      confirm the existing "reuse of the same jti" test still passes
      unmodified
- [x] 2.2 Add a unit test: family already revoked, but this specific
      jti was never individually blacklisted — `isRevoked` resolves
      true, `execute` still rejects and does not issue a new pair
- [x] 2.3 Add an e2e test reproducing the exact live-tested scenario:
      login → rotate (R0→R1) → reuse R0 (detects reuse, revokes family)
      → attempt to use R1 → expect 401, not a fresh token pair
      (needed a `resetRateLimits()` call — this test tipped the file's
      `POST /auth/register` call count over its 10/60s limit and made
      the following test flake with 429; same pattern already used
      before the profile test in this file)

## 3. Verification

- [x] 3.1 Run the full unit + e2e suite and confirm it passes — 120/120
      unit (was 119, +1 new), 21/21 e2e (was 20, +1 new), 11/11
      integration unaffected
- [x] 3.2 Manually reproduce the exact live sequence from the bug
      report against the running dev server and confirm step 3 now
      returns 401 instead of 200 — confirmed: `{"message":"Refresh
      token reuse detected","error":"Unauthorized","statusCode":401}`
