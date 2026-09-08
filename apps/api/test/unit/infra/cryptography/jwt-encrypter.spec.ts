import { JwtService } from '@nestjs/jwt';
import { JwtEncrypter } from '@/infra/cryptography/jwt-encrypter';

describe('JwtEncrypter', () => {
  function makeEnvMock(overrides: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = {
      JWT_PRIVATE_KEY_PATH: './keys/private.pem',
      JWT_PUBLIC_KEY_PATH: './keys/public.pem',
      JWT_ACCESS_TOKEN_TTL_SECONDS: 900,
      JWT_REFRESH_TOKEN_TTL_SECONDS: 604800,
      ...overrides,
    };
    return { get: jest.fn((key: string) => values[key]) } as any;
  }

  it('issues an access/refresh pair with distinct jtis and a shared familyId', () => {
    const encrypter = new JwtEncrypter(new JwtService(), makeEnvMock());

    const issued = encrypter.issueTokenPair('user-1');

    expect(issued.accessJti).not.toEqual(issued.refreshJti);
    expect(issued.accessToken).not.toEqual(issued.refreshToken);

    const accessPayload = encrypter.verify(issued.accessToken);
    const refreshPayload = encrypter.verify(issued.refreshToken);
    expect(accessPayload.type).toBe('access');
    expect(refreshPayload.type).toBe('refresh');
    expect(accessPayload.familyId).toBe(refreshPayload.familyId);
    expect(accessPayload.sub).toBe('user-1');
  });

  it('reuses the given familyId when rotating (instead of starting a new family)', () => {
    const encrypter = new JwtEncrypter(new JwtService(), makeEnvMock());

    const issued = encrypter.issueTokenPair('user-1', 'existing-family');

    expect(issued.familyId).toBe('existing-family');
  });

  it('rejects a tampered token (signature no longer matches)', () => {
    const encrypter = new JwtEncrypter(new JwtService(), makeEnvMock());
    const issued = encrypter.issueTokenPair('user-1');
    // Flip a character in the middle of the signature segment, not the
    // very last one - base64url's final character can have "don't care"
    // padding bits that sometimes decode to the same bytes, which would
    // make this test flaky by accident.
    const midpoint = Math.floor(issued.accessToken.length / 2);
    const charAtMidpoint = issued.accessToken[midpoint];
    const flipped = charAtMidpoint === 'a' ? 'b' : 'a';
    const tampered =
      issued.accessToken.slice(0, midpoint) +
      flipped +
      issued.accessToken.slice(midpoint + 1);

    expect(() => encrypter.verify(tampered)).toThrow();
  });

  it('exposes the configured TTLs', () => {
    const encrypter = new JwtEncrypter(
      new JwtService(),
      makeEnvMock({
        JWT_ACCESS_TOKEN_TTL_SECONDS: 123,
        JWT_REFRESH_TOKEN_TTL_SECONDS: 456,
      }),
    );

    expect(encrypter.accessTtlSeconds).toBe(123);
    expect(encrypter.refreshTtlSeconds).toBe(456);
  });
});
