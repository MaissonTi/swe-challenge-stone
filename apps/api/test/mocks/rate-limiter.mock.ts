import { IRateLimiter } from '@/domain/protocols/cache/rate-limiter.interface';

export function makeRateLimiterMock(): jest.Mocked<IRateLimiter> {
  return {
    consume: jest.fn(),
  };
}
