import Redis from 'ioredis';

/**
 * Runs against the real rate limiter (login is 5/60s by design - see
 * specs/user-auth), so leftover counters from a previous run, or from
 * manual testing against the same local stack, can make an early test
 * spuriously fail with a stuck "invalid credentials" message that's
 * actually a 429. Mirrors apps/api/test/e2e/helpers/reset-rate-limits.ts.
 */
export default async function globalSetup(): Promise<void> {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  try {
    const keys = await redis.keys('ratelimit:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } finally {
    await redis.quit();
  }
}
