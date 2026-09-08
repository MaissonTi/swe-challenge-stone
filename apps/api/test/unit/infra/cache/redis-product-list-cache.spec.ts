import { RedisProductListCache } from '@/infra/cache/redis-product-list-cache';

describe('RedisProductListCache', () => {
  function makeRedisMock() {
    return { get: jest.fn(), set: jest.fn(), incr: jest.fn() } as any;
  }

  const page = {
    items: [
      {
        productId: 'p1',
        name: 'Notebook',
        category: 'ELECTRONICS' as const,
        active: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ],
    nextCursor: undefined,
  };

  it('returns null on a cache miss', async () => {
    const redis = makeRedisMock();
    redis.get.mockResolvedValueOnce(null);
    const cache = new RedisProductListCache(redis);

    await expect(cache.get('some-key')).resolves.toBeNull();
  });

  it('round-trips a page through JSON serialization', async () => {
    const redis = makeRedisMock();
    redis.get.mockResolvedValueOnce(JSON.stringify(page));
    const cache = new RedisProductListCache(redis);

    await expect(cache.get('some-key')).resolves.toEqual(page);
  });

  it('writes the page with the given TTL', async () => {
    const redis = makeRedisMock();
    const cache = new RedisProductListCache(redis);

    await cache.set('some-key', page, 45);

    expect(redis.set).toHaveBeenCalledWith(
      'some-key',
      JSON.stringify(page),
      'EX',
      45,
    );
  });

  it('fails safe (null) on read when Redis is unavailable', async () => {
    const redis = makeRedisMock();
    redis.get.mockRejectedValue(new Error('connection refused'));
    const cache = new RedisProductListCache(redis);

    await expect(cache.get('some-key')).resolves.toBeNull();
  });

  it('fails safe (no-op) on write when Redis is unavailable', async () => {
    const redis = makeRedisMock();
    redis.set.mockRejectedValue(new Error('connection refused'));
    const cache = new RedisProductListCache(redis);

    await expect(cache.set('some-key', page, 45)).resolves.toBeUndefined();
  });

  it('reads the current generation, treating a missing key as 0', async () => {
    const redis = makeRedisMock();
    redis.get.mockResolvedValueOnce(null);
    const cache = new RedisProductListCache(redis);

    await expect(cache.getGeneration()).resolves.toBe(0);

    redis.get.mockResolvedValueOnce('7');
    const fresh = new RedisProductListCache(redis);
    await expect(fresh.getGeneration()).resolves.toBe(7);
  });

  it('memoizes the generation briefly to avoid a round-trip per read', async () => {
    const redis = makeRedisMock();
    redis.get.mockResolvedValue('2');
    const cache = new RedisProductListCache(redis);

    await cache.getGeneration();
    await cache.getGeneration();

    expect(redis.get).toHaveBeenCalledTimes(1);
  });

  it('advances the generation on bump and reflects it immediately', async () => {
    const redis = makeRedisMock();
    redis.incr.mockResolvedValueOnce(5);
    const cache = new RedisProductListCache(redis);

    await cache.bumpGeneration();

    expect(redis.incr).toHaveBeenCalledWith('products:list:gen');
    await expect(cache.getGeneration()).resolves.toBe(5);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('fails safe (generation 0) when Redis is unavailable on read', async () => {
    const redis = makeRedisMock();
    redis.get.mockRejectedValue(new Error('connection refused'));
    const cache = new RedisProductListCache(redis);

    await expect(cache.getGeneration()).resolves.toBe(0);
  });

  it('fails safe (no-op) when Redis is unavailable on bump', async () => {
    const redis = makeRedisMock();
    redis.incr.mockRejectedValue(new Error('connection refused'));
    const cache = new RedisProductListCache(redis);

    await expect(cache.bumpGeneration()).resolves.toBeUndefined();
  });
});
