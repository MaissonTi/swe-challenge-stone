import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '@/infra/auth/jwt.strategy';
import { makeTokenRevocationStoreMock } from '../../../mocks/token-revocation-store.mock';

describe('JwtStrategy', () => {
  function makeEnvMock() {
    return {
      get: jest.fn((key: string) => {
        if (key === 'JWT_PUBLIC_KEY_PATH') return './keys/public.pem';
        return undefined;
      }),
    } as any;
  }

  const basePayload = {
    sub: 'user-1',
    jti: 'jti-1',
    familyId: 'family-1',
    type: 'access' as const,
    iat: 1000,
    exp: 2000,
  };

  it('accepts a valid, non-revoked access token', async () => {
    const revocationStore = makeTokenRevocationStoreMock();
    revocationStore.isRevoked.mockResolvedValueOnce(false);
    const strategy = new JwtStrategy(revocationStore, makeEnvMock());

    await expect(strategy.validate(basePayload)).resolves.toBe(basePayload);
    expect(revocationStore.isRevoked).toHaveBeenCalledWith('jti-1', 'family-1');
  });

  it('rejects a token that is not of type access (e.g. a refresh token)', async () => {
    const revocationStore = makeTokenRevocationStoreMock();
    const strategy = new JwtStrategy(revocationStore, makeEnvMock());

    await expect(
      strategy.validate({ ...basePayload, type: 'refresh' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(revocationStore.isRevoked).not.toHaveBeenCalled();
  });

  it('rejects a revoked token', async () => {
    const revocationStore = makeTokenRevocationStoreMock();
    revocationStore.isRevoked.mockResolvedValueOnce(true);
    const strategy = new JwtStrategy(revocationStore, makeEnvMock());

    await expect(strategy.validate(basePayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
