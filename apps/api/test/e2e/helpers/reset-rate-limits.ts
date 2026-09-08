import Redis from 'ioredis';

/**
 * e2e tests hit the real rate limiter (it's not mocked out - that's the
 * point of an e2e test). Without this, leftover counters from a previous
 * run (or from manually poking the API while it was up) could make an
 * early test in the suite spuriously fail with 429. Clearing rate-limit
 * keys before the suite runs is test-environment hygiene, not a change
 * to the rate limiter itself.
 */
export async function resetRateLimits(): Promise<void> {
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
