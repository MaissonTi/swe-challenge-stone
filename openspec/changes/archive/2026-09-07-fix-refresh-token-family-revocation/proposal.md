## Why

Found via live end-to-end testing of the full auth flow: cascading
family revocation on refresh-token reuse doesn't actually revoke the
family's other refresh tokens. `RefreshTokenUseCase` only checks whether
the *specific* token presented was already blacklisted
(`isTokenBlacklisted(jti)`), never whether its *family* was blacklisted
(`isRevoked(jti, familyId)`, which the access-token guard already uses
correctly). Reproduced live, twice: after reuse of an old refresh token
triggers `blacklistFamily(...)`, the family's still-unused, more recent
refresh token is still accepted and successfully rotates into a new
pair — exactly the scenario `openspec/specs/user-auth/spec.md`'s
"Refresh Token Reuse Detection" requirement says must not happen
("revokes... every token issued from that same login session").

The spec already describes the correct behavior; this fixes the
implementation to match it — no spec change needed.

## What Changes

- `RefreshTokenUseCase.execute` checks `isRevoked(jti, familyId)`
  instead of `isTokenBlacklisted(jti)` before honoring a refresh
  request, so a refresh token whose family was already blacklisted
  (by a sibling token's reuse) is rejected too, not just the specific
  jti that was reused.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — `user-auth`'s existing "Refresh Token Reuse Detection"
requirement already specifies this behavior; this is a defect fix, not
a behavior change)

## Impact

- `apps/api/src/app/usecases/authenticate/refresh-token.usecase.ts`
- `apps/api/test/unit/app/usecases/authenticate/refresh-token.usecase.spec.ts`
  (new case: family already revoked, different jti)
- `apps/api/test/e2e/auth.e2e-spec.ts` (new case: the live-tested
  scenario above, end to end)
