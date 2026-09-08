export const RATE_LIMITER = Symbol('RateLimiter');

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the caller may retry - used for the `Retry-After` header. */
  retryAfterSeconds: number;
};

/**
 * Port for the distributed rate limiter. Adapter:
 * infra/cache/redis-rate-limiter.ts (sliding window counter). Expected to
 * fail open (allowed: true) if the backing store is unreachable - see
 * design.md, Resilience.
 */
export interface IRateLimiter {
  consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult>;
}
