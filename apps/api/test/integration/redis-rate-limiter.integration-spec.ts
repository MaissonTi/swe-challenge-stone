import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { RedisRateLimiter } from '@/infra/cache/redis-rate-limiter';

/**
 * Requires the local stack up (`docker compose up -d`) - talks to a real
 * Redis, not a mock, specifically to exercise the sliding-window math
 * (the Lua script) across an actual window boundary, which a unit test
 * mocking `redis.eval` cannot meaningfully verify.
 */
describe('RedisRateLimiter (integration)', () => {
  let redis: Redis;
  let limiter: RedisRateLimiter;
  const windowSeconds = 2;
  const limit = 4;

  beforeAll(() => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    limiter = new RedisRateLimiter(redis);
  });

  afterAll(async () => {
    await redis.quit();
  });

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  it('carries weight into the next window instead of resetting abruptly at the boundary', async () => {
    const key = `integration-test:${randomUUID()}`;

    // Align to the start of a fresh window first - otherwise "sleep one
    // window" below could land two windows ahead instead of one,
    // depending on where in the cycle the test happened to start.
    const msIntoWindow = Date.now() % (windowSeconds * 1000);
    await sleep(windowSeconds * 1000 - msIntoWindow + 50);

    // Saturate the (now fresh) current window right up to the limit.
    for (let i = 0; i < limit; i++) {
      const result = await limiter.consume(key, limit, windowSeconds);
      expect(result.allowed).toBe(true);
    }

    // Cross into the next window.
    await sleep(windowSeconds * 1000 + 100);

    // A naive fixed-window counter would reset to 0 here and allow this
    // request outright. The sliding window should still carry most of the
    // previous window's weight (elapsed is tiny) and reject it.
    const justAfterBoundary = await limiter.consume(key, limit, windowSeconds);
    expect(justAfterBoundary.allowed).toBe(false);

    // Once enough of the new window has elapsed, the carried-over weight
    // decays and a fresh request is allowed again.
    await sleep(windowSeconds * 1000 * 0.9);
    const laterInWindow = await limiter.consume(key, limit, windowSeconds);
    expect(laterInWindow.allowed).toBe(true);
  }, 15000);

  it('fails open when pointed at an unreachable Redis', async () => {
    const unreachable = new Redis('redis://127.0.0.1:1', {
      connectTimeout: 100,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    const isolatedLimiter = new RedisRateLimiter(unreachable);

    const result = await isolatedLimiter.consume('unreachable-key', 5, 60);

    expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
    unreachable.disconnect();
  });
});
