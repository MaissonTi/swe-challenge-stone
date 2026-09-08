import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { ITokenRevocationStore } from '../../domain/protocols/cache/token-revocation-store.interface';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../observability/trace.decorator';
import { REDIS_CLIENT } from './redis-client.provider';

@Injectable()
export class RedisTokenRevocationStore implements ITokenRevocationStore {
  private readonly logger = new Logger(RedisTokenRevocationStore.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  @TraceSpan({ prefix: TracePrefixEnum.Cache })
  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.redis.set(`blacklist:${jti}`, '1', 'EX', ttlSeconds);
  }

  @TraceSpan({ prefix: TracePrefixEnum.Cache })
  async blacklistFamily(familyId: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.redis.set(`blacklist:family:${familyId}`, '1', 'EX', ttlSeconds);
  }

  @TraceSpan({ prefix: TracePrefixEnum.Cache })
  async isRevoked(jti: string, familyId: string): Promise<boolean> {
    try {
      const [tokenBlacklisted, familyBlacklisted] = await Promise.all([
        this.redis.exists(`blacklist:${jti}`),
        this.redis.exists(`blacklist:family:${familyId}`),
      ]);
      return tokenBlacklisted === 1 || familyBlacklisted === 1;
    } catch (err) {
      this.logger.warn(
        `Redis unavailable, failing open on revocation check: ${err}`,
      );
      return false;
    }
  }

  @TraceSpan({ prefix: TracePrefixEnum.Cache })
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    try {
      return (await this.redis.exists(`blacklist:${jti}`)) === 1;
    } catch (err) {
      this.logger.warn(
        `Redis unavailable, failing open on reuse check: ${err}`,
      );
      return false;
    }
  }
}
