import { LogoutUseCase } from '@/app/usecases/authenticate/logout.usecase';
import { makeEncrypterMock } from '../../../../mocks/encrypter.mock';
import { makeTokenRevocationStoreMock } from '../../../../mocks/token-revocation-store.mock';

describe('LogoutUseCase', () => {
  let encrypter: ReturnType<typeof makeEncrypterMock>;
  let revocationStore: ReturnType<typeof makeTokenRevocationStoreMock>;
  let useCase: LogoutUseCase;

  beforeEach(() => {
    encrypter = makeEncrypterMock();
    revocationStore = makeTokenRevocationStoreMock();
    useCase = new LogoutUseCase(encrypter, revocationStore);
  });

  it('blacklists the current access token', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    await useCase.execute({
      accessJti: 'access-jti',
      accessExp: nowSeconds + 900,
    });

    expect(revocationStore.blacklistToken).toHaveBeenCalledWith(
      'access-jti',
      expect.any(Number),
    );
  });

  it('also blacklists the refresh token when provided', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    encrypter.verify.mockReturnValueOnce({
      sub: 'user-1',
      jti: 'refresh-jti',
      familyId: 'family-1',
      type: 'refresh',
      iat: nowSeconds,
      exp: nowSeconds + 604800,
    });

    await useCase.execute({
      accessJti: 'access-jti',
      accessExp: nowSeconds + 900,
      refreshToken: 'refresh-token',
    });

    expect(revocationStore.blacklistToken).toHaveBeenCalledWith(
      'access-jti',
      expect.any(Number),
    );
    expect(revocationStore.blacklistToken).toHaveBeenCalledWith(
      'refresh-jti',
      expect.any(Number),
    );
  });

  it('does not throw if the provided refresh token is already invalid', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    encrypter.verify.mockImplementationOnce(() => {
      throw new Error('expired');
    });

    await expect(
      useCase.execute({
        accessJti: 'access-jti',
        accessExp: nowSeconds + 900,
        refreshToken: 'expired-refresh-token',
      }),
    ).resolves.toBeUndefined();
  });
});
