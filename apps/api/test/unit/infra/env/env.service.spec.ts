import { EnvService } from '@/infra/env/env.service';

describe('EnvService', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('falls back to the documented defaults when nothing is set', () => {
    process.env = {};

    const env = new EnvService();

    expect(env.get('PORT')).toBe(3000);
    expect(env.get('AWS_REGION')).toBe('us-east-1');
    expect(env.get('USERS_TABLE_NAME')).toBe('Users');
    expect(env.get('PRODUCTS_TABLE_NAME')).toBe('Products');
    expect(env.get('REDIS_URL')).toBe('redis://localhost:6379');
    expect(env.get('JWT_ACCESS_TOKEN_TTL_SECONDS')).toBe(900);
    expect(env.get('JWT_REFRESH_TOKEN_TTL_SECONDS')).toBe(604800);
  });

  it('honors explicit values and coerces numeric env vars from strings', () => {
    process.env = {
      ...originalEnv,
      PORT: '4000',
      JWT_ACCESS_TOKEN_TTL_SECONDS: '120',
    };

    const env = new EnvService();

    expect(env.get('PORT')).toBe(4000);
    expect(env.get('JWT_ACCESS_TOKEN_TTL_SECONDS')).toBe(120);
  });
});
