import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import {
  IRateLimiter,
  RateLimitResult,
} from '../../domain/protocols/cache/rate-limiter.interface';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../observability/trace.decorator';
import { REDIS_CLIENT } from './redis-client.provider';

/**
 * Sliding-window counter (not a naive fixed window - see docs/PRD.md,
 * §4.3, and design.md): two fixed windows (current + previous),
 * combined as `estimate = previous * (1 - elapsedFraction) + current`.
 * Runs as a single Lua script so the increment + limit check stay
 * atomic across concurrent requests.
 */
const SLIDING_WINDOW_SCRIPT = `
local current_key = KEYS[1]
local previous_key = KEYS[2]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])

local time = redis.call('TIME')
local now = tonumber(time[1])
local elapsed = now % window

local current = redis.call('INCR', current_key)
redis.call('EXPIRE', current_key, window * 2)
local previous = tonumber(redis.call('GET', previous_key) or '0')

local weight = (window - elapsed) / window
local estimate = (previous * weight) + current
local retry_after = window - elapsed

if estimate > limit then
  return {0, retry_after}
end
return {1, retry_after}
`;

@Injectable()
export class RedisRateLimiter implements IRateLimiter {
  private readonly logger = new Logger(RedisRateLimiter.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  @TraceSpan({ prefix: TracePrefixEnum.Cache })
  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    try {
      const windowIndex = Math.floor(Date.now() / 1000 / windowSeconds);
      const currentKey = `ratelimit:${key}:${windowIndex}`;
      const previousKey = `ratelimit:${key}:${windowIndex - 1}`;

      const [allowedFlag, retryAfter] = (await this.redis.eval(
        SLIDING_WINDOW_SCRIPT,
        2,
        currentKey,
        previousKey,
        windowSeconds,
        limit,
      )) as [number, number];

      return { allowed: allowedFlag === 1, retryAfterSeconds: retryAfter };
    } catch (err) {
      this.logger.warn(`Redis unavailable, failing open on rate limit: ${err}`);
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }
}
