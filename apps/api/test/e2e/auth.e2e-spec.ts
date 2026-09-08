import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';
import { resetRateLimits } from './helpers/reset-rate-limits';

/**
 * Full-stack e2e: real HTTP requests via supertest against a real running
 * Nest app, talking to the real local DynamoDB/Redis (Docker Compose).
 * Requires `docker compose up -d` + tables bootstrapped beforehand.
 *
 * This file makes exactly 5 calls to POST /auth/login before the profile
 * tests (count them before adding a 6th) - login is rate-limited to
 * 5/60s by design (see docs/PRD.md, §4.3), and jest-e2e.json runs files
 * sequentially (maxWorkers: 1) specifically so this budget isn't shared
 * unpredictably with other e2e files. The profile test resets the
 * counter itself before its own login call.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetRateLimits();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueEmail() {
    return `e2e-${randomUUID()}@stone.com.br`;
  }

  it('registers a new user and responds 204 without leaking anything', async () => {
    const email = uniqueEmail();

    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'Password1' })
      .expect(204);
  });

  it('responds 204 even when the e-mail is already registered', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'Password1' })
      .expect(204);

    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'AnotherPass1' })
      .expect(204);
  });

  it('rejects a password that does not meet the policy', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: uniqueEmail(), password: 'weak' })
      .expect(400);
  });

  it('rejects a password containing whitespace, even if otherwise valid', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: uniqueEmail(), password: 'Password 1' })
      .expect(400);
  });

  it('groups validation errors by field when multiple fields are invalid', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: 'not-an-email', password: 'weak' })
      .expect(400);

    expect(response.body.message).toBe('Validation failed');
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        {
          path: 'email',
          messages: expect.arrayContaining([expect.any(String)]),
        },
        {
          path: 'password',
          messages: expect.arrayContaining([expect.any(String)]),
        },
      ]),
    );
    // "weak" violates 3 rules (length, uppercase, number) - they should
    // become a single entry with 3 messages, not 3 entries repeating path.
    const passwordGroup = response.body.errors.find(
      (e: { path: string }) => e.path === 'password',
    );
    expect(passwordGroup.messages).toHaveLength(3);
  });

  it('logs in and issues an access/refresh token pair', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'Password1' })
      .expect(204);

    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'Password1' })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
  });

  it('rejects wrong password and nonexistent e-mail with the same generic error', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'Password1' })
      .expect(204);

    const wrongPassword = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'WrongPassword1' })
      .expect(401);

    const nonexistentEmail = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: uniqueEmail(), password: 'Whatever1' })
      .expect(401);

    expect(wrongPassword.body.message).toEqual(nonexistentEmail.body.message);
  });

  it('rotates the refresh token and rejects reuse of the old one', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'Password1' })
      .expect(204);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'Password1' })
      .expect(200);

    const refreshed = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    expect(refreshed.body.accessToken).not.toEqual(login.body.accessToken);

    // The old refresh token was rotated out - reusing it is theft signal.
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  it("cascading revocation also blocks the family's newest refresh token, not just the reused one", async () => {
    // Found via manual end-to-end testing: reuse detection was only
    // checking whether *this exact* jti had been individually
    // blacklisted, never whether its *family* had been - so a sibling
    // token that was never itself reused kept working after the theft
    // signal fired. R0 -> rotate to R1 -> reuse R0 (detects theft,
    // revokes the family) -> R1 must now be rejected too, even though
    // R1 itself was never reused.
    //
    // This is the 9th POST /auth/register call in this file (limit is
    // 10/60s) - reset here so this test's own call, and the next test's,
    // don't get spuriously 429'd by the accumulated budget.
    await resetRateLimits();
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'Password1' })
      .expect(204);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'Password1' })
      .expect(200);
    const r0 = login.body.refreshToken;

    const rotated = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: r0 })
      .expect(200);
    const r1 = rotated.body.refreshToken;

    // Reusing r0 detects theft and revokes the whole family.
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: r0 })
      .expect(401);

    // r1 was never reused, but it belongs to the now-revoked family.
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: r1 })
      .expect(401);
  });

  it('requires authentication to log out, then revokes the access token', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .send({})
      .expect(401);

    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'Password1' })
      .expect(204);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'Password1' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({})
      .expect(204);

    // Same access token, already revoked.
    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({})
      .expect(401);
  });

  it('rejects a profile request without a valid access token', async () => {
    await request(app.getHttpServer()).get('/v1/auth/me').expect(401);
  });

  it('returns the profile of the authenticated user', async () => {
    // This file's login budget (5/60s, see the file header) is already
    // spent by the earlier tests - reset it for this test's own login call.
    await resetRateLimits();
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'Password1' })
      .expect(204);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'Password1' })
      .expect(200);

    const profile = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(profile.body).toEqual({
      userId: expect.any(String),
      email,
      createdAt: expect.any(String),
    });
    expect(profile.body).not.toHaveProperty('passwordHash');
  });
});
