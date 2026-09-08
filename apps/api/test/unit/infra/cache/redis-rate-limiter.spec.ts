import { RedisRateLimiter } from '@/infra/cache/redis-rate-limiter';

describe('RedisRateLimiter', () => {
  function makeRedisMock() {
    return { eval: jest.fn() } as any;
  }

  it('allows the request when under the limit', async () => {
    const redis = makeRedisMock();
    redis.eval.mockResolvedValueOnce([1, 45]);
    const limiter = new RedisRateLimiter(redis);

    const result = await limiter.consume('some-key', 10, 60);

    expect(result).toEqual({ allowed: true, retryAfterSeconds: 45 });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      expect.stringContaining('ratelimit:some-key:'),
      expect.stringContaining('ratelimit:some-key:'),
      60,
      10,
    );
  });

  it('rejects the request when the sliding window estimate exceeds the limit', async () => {
    const redis = makeRedisMock();
    redis.eval.mockResolvedValueOnce([0, 12]);
    const limiter = new RedisRateLimiter(redis);

    const result = await limiter.consume('some-key', 10, 60);

    expect(result).toEqual({ allowed: false, retryAfterSeconds: 12 });
  });

  it('fails open (allowed: true) when Redis is unavailable', async () => {
    const redis = makeRedisMock();
    redis.eval.mockRejectedValue(new Error('connection refused'));
    const limiter = new RedisRateLimiter(redis);

    const result = await limiter.consume('some-key', 10, 60);

    expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });
});
