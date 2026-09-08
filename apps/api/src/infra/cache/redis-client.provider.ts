import Redis from 'ioredis';
import { EnvService } from '../env/env.service';

export const REDIS_CLIENT = Symbol('RedisClient');

export const redisClientProvider = {
  provide: REDIS_CLIENT,
  useFactory: (env: EnvService) => {
    return new Redis(env.get('REDIS_URL'), {
      // Fail fast so guards can fall back (fail-open) instead of hanging
      // the request while Redis is unreachable.
      connectTimeout: 200,
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => Math.min(times * 200, 2000),
    });
  },
  inject: [EnvService],
};
