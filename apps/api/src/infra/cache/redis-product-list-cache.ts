import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { IProductListCache } from '../../domain/protocols/cache/product-list-cache.interface';
import { ProductListPage } from '../../domain/protocols/database/repositories/product.repository.interface';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../observability/trace.decorator';
import { REDIS_CLIENT } from './redis-client.provider';

@Injectable()
export class RedisProductListCache implements IProductListCache {
  private static readonly GENERATION_KEY = 'products:list:gen';
  /** How long a read generation is trusted in memory before re-reading it. */
  private static readonly GENERATION_MEMO_MS = 1000;

  private readonly logger = new Logger(RedisProductListCache.name);
  private generationMemo: { value: number; readAt: number } | null = null;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  @TraceSpan({ prefix: TracePrefixEnum.Cache })
  async get(cacheKey: string): Promise<ProductListPage | null> {
    try {
      const raw = await this.redis.get(cacheKey);
      return raw ? (JSON.parse(raw) as ProductListPage) : null;
    } catch (err) {
      this.logger.warn(`Redis unavailable, bypassing cache read: ${err}`);
      return null;
    }
  }

  @TraceSpan({ prefix: TracePrefixEnum.Cache })
  async set(
    cacheKey: string,
    page: ProductListPage,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redis.set(cacheKey, JSON.stringify(page), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Redis unavailable, skipping cache write: ${err}`);
    }
  }

  @TraceSpan({ prefix: TracePrefixEnum.Cache })
  async getGeneration(): Promise<number> {
    const now = Date.now();
    if (
      this.generationMemo &&
      now - this.generationMemo.readAt <
        RedisProductListCache.GENERATION_MEMO_MS
    ) {
      return this.generationMemo.value;
    }

    try {
      const raw = await this.redis.get(RedisProductListCache.GENERATION_KEY);
      const parsed = raw ? Number.parseInt(raw, 10) : 0;
      const value = Number.isFinite(parsed) ? parsed : 0;
      this.generationMemo = { value, readAt: now };
      return value;
    } catch (err) {
      this.logger.warn(`Redis unavailable, using generation 0: ${err}`);
      return 0;
    }
  }

  @TraceSpan({ prefix: TracePrefixEnum.Cache })
  async bumpGeneration(): Promise<void> {
    try {
      const next = await this.redis.incr(RedisProductListCache.GENERATION_KEY);
      this.generationMemo = { value: next, readAt: Date.now() };
    } catch (err) {
      this.logger.warn(
        `Redis unavailable, skipping cache invalidation: ${err}`,
      );
      this.generationMemo = null;
    }
  }
}
