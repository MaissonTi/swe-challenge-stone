export const TOKEN_REVOCATION_STORE = Symbol('TokenRevocationStore');

/**
 * Port for token revocation (logout, reuse detection). Adapter:
 * infra/cache/redis-token-revocation-store.ts. Every read is expected to
 * fail open (treat "store unreachable" as "not revoked") - see
 * design.md, Resilience.
 */
export interface ITokenRevocationStore {
  blacklistToken(jti: string, ttlSeconds: number): Promise<void>;
  blacklistFamily(familyId: string, ttlSeconds: number): Promise<void>;
  isRevoked(jti: string, familyId: string): Promise<boolean>;
  isTokenBlacklisted(jti: string): Promise<boolean>;
}
