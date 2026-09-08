import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenUseCase } from '@/app/usecases/authenticate/refresh-token.usecase';
import { makeEncrypterMock } from '../../../../mocks/encrypter.mock';
import { makeTokenRevocationStoreMock } from '../../../../mocks/token-revocation-store.mock';

describe('RefreshTokenUseCase', () => {
  let encrypter: ReturnType<typeof makeEncrypterMock>;
  let revocationStore: ReturnType<typeof makeTokenRevocationStoreMock>;
  let useCase: RefreshTokenUseCase;

  const basePayload = {
    sub: 'user-1',
    jti: 'old-jti',
    familyId: 'family-1',
    type: 'refresh' as const,
    iat: 1000,
    exp: 1000 + 3600,
  };

  beforeEach(() => {
    encrypter = makeEncrypterMock();
    revocationStore = makeTokenRevocationStoreMock();
    useCase = new RefreshTokenUseCase(encrypter, revocationStore);
  });

  it('rotates the token: blacklists the old jti and issues a new pair for the same family', async () => {
    encrypter.verify.mockReturnValueOnce(basePayload);
    revocationStore.isRevoked.mockResolvedValueOnce(false);
    const issued = {
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      accessJti: 'new-a-jti',
      refreshJti: 'new-r-jti',
      familyId: 'family-1',
    };
    encrypter.issueTokenPair.mockReturnValueOnce(issued);

    const result = await useCase.execute({ refreshToken: 'old-refresh-token' });

    expect(revocationStore.blacklistToken).toHaveBeenCalledWith(
      'old-jti',
      expect.any(Number),
    );
    expect(encrypter.issueTokenPair).toHaveBeenCalledWith('user-1', 'family-1');
    expect(result).toBe(issued);
  });

  it('detects reuse of an already-blacklisted refresh token and revokes the whole family', async () => {
    encrypter.verify.mockReturnValueOnce(basePayload);
    revocationStore.isRevoked.mockResolvedValueOnce(true);

    await expect(
      useCase.execute({ refreshToken: 'stolen-refresh-token' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(revocationStore.isRevoked).toHaveBeenCalledWith(
      'old-jti',
      'family-1',
    );
    expect(revocationStore.blacklistFamily).toHaveBeenCalledWith(
      'family-1',
      encrypter.refreshTtlSeconds,
    );
    expect(encrypter.issueTokenPair).not.toHaveBeenCalled();
  });

  it('rejects a token whose family was already revoked, even though this exact jti was never used before', async () => {
    // Reproduces the bug found via manual testing: reusing a SIBLING
    // token already revokes the whole family - this jti was never
    // individually blacklisted, but isRevoked() should still resolve
    // true because of the family blacklist. Checking only
    // isTokenBlacklisted(jti) (the bug) would let this token through
    // and issue a fresh pair.
    encrypter.verify.mockReturnValueOnce(basePayload);
    revocationStore.isRevoked.mockResolvedValueOnce(true);
    revocationStore.isTokenBlacklisted.mockResolvedValueOnce(false);

    await expect(
      useCase.execute({ refreshToken: 'never-individually-used-token' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(encrypter.issueTokenPair).not.toHaveBeenCalled();
  });

  it('rejects a token that is not of type refresh', async () => {
    encrypter.verify.mockReturnValueOnce({ ...basePayload, type: 'access' });

    await expect(
      useCase.execute({ refreshToken: 'an-access-token' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid/unverifiable token', async () => {
    encrypter.verify.mockImplementationOnce(() => {
      throw new Error('bad signature');
    });

    await expect(useCase.execute({ refreshToken: 'garbage' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
