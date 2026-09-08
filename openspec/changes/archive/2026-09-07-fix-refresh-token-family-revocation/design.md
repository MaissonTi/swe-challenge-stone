## Context

See proposal.md - Why. `ITokenRevocationStore` already exposes both
checks needed: `isTokenBlacklisted(jti)` (individual token) and
`isRevoked(jti, familyId)` (individual OR family). `jwt.strategy.ts`
(access-token guard) already calls the combined `isRevoked` check
correctly; `refresh-token.usecase.ts` calls only the narrower
`isTokenBlacklisted`.

## Goals / Non-Goals

**Goals:**

- Make refresh-token reuse detection actually block every token in a
  revoked family, matching the already-documented spec behavior.

**Non-Goals:**

- Changing the revocation store interface or Redis key scheme — both
  already exist and are correct; this is purely a call-site fix.

## Decisions

**Swap the check, don't add a new one.** Replace
`isTokenBlacklisted(payload.jti)` with
`isRevoked(payload.jti, payload.familyId)` in
`RefreshTokenUseCase.execute`. This is the same check the access-token
path already uses, so there's no new interface surface, no new Redis
key, and no ambiguity about which check is "the real one" going
forward — both token kinds now agree on what "revoked" means.

**Semantics don't change for the already-tested case.** `isRevoked`
returns true whenever `isTokenBlacklisted` would have (individual jti
blacklisted) - it's an OR over jti-blacklist and family-blacklist - so
the existing "reuse of the same token" unit test keeps passing
unmodified; only the previously-missing "family blacklisted, different
jti" branch newly returns true.

## Risks / Trade-offs

- [A legitimately rotating client whose family was falsely flagged
  (e.g. a transient false-positive) now also gets locked out on its
  next refresh, not just the reused one] → This is the intended,
  specified behavior (cascading revocation treats the whole session as
  compromised on reuse) — not a new risk introduced by this fix, just
  the risk the feature already claimed to cover, now actually covered.
