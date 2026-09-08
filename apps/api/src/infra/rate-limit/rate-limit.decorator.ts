import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export type RateLimitOptions = {
  limit: number;
  windowSeconds: number;
};

/** Default applied to any route that doesn't set its own @RateLimit(). */
export const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  limit: 100,
  windowSeconds: 60,
};

/** Overrides the rate limit for a specific route (e.g. a stricter limit on login). */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
