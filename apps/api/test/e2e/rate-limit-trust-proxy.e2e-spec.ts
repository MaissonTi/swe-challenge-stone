import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';
import { resetRateLimits } from './helpers/reset-rate-limits';

/**
 * Proves the fix-rate-limit-trust-proxy mechanism against a real request,
 * not just that Express's docs say `trust proxy` should work: with it
 * configured, two clients behind the same reverse proxy (identified by
 * X-Forwarded-For) get independent rate-limit buckets; without it (the
 * default), they collapse into one - see that change's design.md for the
 * full rationale.
 *
 * Login is rate-limited to 5/60s (see docs/PRD.md §4.3) - each `it` below
 * budgets exactly 6 login calls and resets the counter first, so the two
 * scenarios don't interfere with each other. Wrong credentials are used
 * throughout: RateLimitGuard runs before the handler regardless of outcome,
 * so a 401 still counts against the bucket, and no real user is needed.
 */
describe('Rate limit behind a trusted reverse proxy (e2e)', () => {
  async function attemptLogin(app: INestApplication, forwardedFor: string) {
    return request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('X-Forwarded-For', forwardedFor)
      .send({ email: 'nobody@stone.com.br', password: 'WrongPassword1' });
  }

  it('tracks two forwarded IPs independently when trust proxy is enabled', async () => {
    await resetRateLimits();
    const app = await createTestApp({ trustProxyHops: 1 });
    try {
      for (let i = 0; i < 5; i++) {
        const response = await attemptLogin(app, '1.1.1.1');
        expect(response.status).not.toBe(429);
      }
      // The 6th request from the same forwarded IP exhausts its own bucket.
      const sameIpSixth = await attemptLogin(app, '1.1.1.1');
      expect(sameIpSixth.status).toBe(429);

      // A different forwarded IP has its own, untouched bucket.
      const differentIp = await attemptLogin(app, '2.2.2.2');
      expect(differentIp.status).not.toBe(429);
    } finally {
      await app.close();
    }
  });

  it('collapses different forwarded IPs into one bucket when trust proxy is disabled (default)', async () => {
    await resetRateLimits();
    const app = await createTestApp(); // trustProxyHops defaults to 0
    try {
      for (let i = 0; i < 5; i++) {
        const response = await attemptLogin(app, '3.3.3.3');
        expect(response.status).not.toBe(429);
      }
      // Different X-Forwarded-For, but trust proxy is off, so it's ignored -
      // every request in this test shares the same real socket address, and
      // that bucket is already exhausted by the loop above.
      const differentIp = await attemptLogin(app, '4.4.4.4');
      expect(differentIp.status).toBe(429);
    } finally {
      await app.close();
    }
  });
});
