import { RedisTokenRevocationStore } from '@/infra/cache/redis-token-revocation-store';
import { makeRedisClientMock } from '../../../mocks/redis-client.mock';

describe('RedisTokenRevocationStore', () => {
  it('reports revoked when the token jti is blacklisted', async () => {
    const redis = makeRedisClientMock();
    redis.exists.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const store = new RedisTokenRevocationStore(redis);

    await expect(store.isRevoked('jti-1', 'family-1')).resolves.toBe(true);
  });

  it('reports revoked when the token family is blacklisted', async () => {
    const redis = makeRedisClientMock();
    redis.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const store = new RedisTokenRevocationStore(redis);

    await expect(store.isRevoked('jti-1', 'family-1')).resolves.toBe(true);
  });

  it('reports not revoked when neither key exists', async () => {
    const redis = makeRedisClientMock();
    redis.exists.mockResolvedValue(0);
    const store = new RedisTokenRevocationStore(redis);

    await expect(store.isRevoked('jti-1', 'family-1')).resolves.toBe(false);
  });

  it('fails open (not revoked) when Redis is unavailable', async () => {
    const redis = makeRedisClientMock();
    redis.exists.mockRejectedValue(new Error('connection refused'));
    const store = new RedisTokenRevocationStore(redis);

    await expect(store.isRevoked('jti-1', 'family-1')).resolves.toBe(false);
  });

  it('fails open on isTokenBlacklisted when Redis is unavailable', async () => {
    const redis = makeRedisClientMock();
    redis.exists.mockRejectedValue(new Error('connection refused'));
    const store = new RedisTokenRevocationStore(redis);

    await expect(store.isTokenBlacklisted('jti-1')).resolves.toBe(false);
  });

  it('does not write to Redis when the TTL is not positive', async () => {
    const redis = makeRedisClientMock();
    const store = new RedisTokenRevocationStore(redis);

    await store.blacklistToken('jti-1', 0);
    await store.blacklistFamily('family-1', -5);

    expect(redis.set).not.toHaveBeenCalled();
  });
});
