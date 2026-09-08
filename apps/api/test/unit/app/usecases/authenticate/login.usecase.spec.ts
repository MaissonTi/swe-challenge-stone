import { UnauthorizedException } from '@nestjs/common';
import { LoginUseCase } from '@/app/usecases/authenticate/login.usecase';
import { makeEncrypterMock } from '../../../../mocks/encrypter.mock';
import { makeHasherMock } from '../../../../mocks/hasher.mock';
import { makeUserRepositoryMock } from '../../../../mocks/user-repository.mock';

describe('LoginUseCase', () => {
  let userRepository: ReturnType<typeof makeUserRepositoryMock>;
  let hasher: ReturnType<typeof makeHasherMock>;
  let encrypter: ReturnType<typeof makeEncrypterMock>;
  let useCase: LoginUseCase;

  beforeEach(() => {
    userRepository = makeUserRepositoryMock();
    hasher = makeHasherMock();
    encrypter = makeEncrypterMock();
    useCase = new LoginUseCase(userRepository, hasher, encrypter);
  });

  it('issues a token pair on successful login', async () => {
    userRepository.findByEmail.mockResolvedValueOnce({
      email: 'user@example.com',
      userId: 'user-1',
      passwordHash: 'stored-hash',
      createdAt: new Date().toISOString(),
    });
    hasher.compare.mockResolvedValueOnce(true);
    const issued = {
      accessToken: 'access',
      refreshToken: 'refresh',
      accessJti: 'a-jti',
      refreshJti: 'r-jti',
      familyId: 'family-1',
    };
    encrypter.issueTokenPair.mockReturnValueOnce(issued);

    const result = await useCase.execute({
      email: 'User@Example.com',
      password: 'Password1',
    });

    expect(result).toBe(issued);
    expect(userRepository.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(encrypter.issueTokenPair).toHaveBeenCalledWith('user-1');
  });

  it('rejects with a generic error when the user does not exist, but still runs a compare', async () => {
    userRepository.findByEmail.mockResolvedValueOnce(null);
    hasher.compare.mockResolvedValueOnce(false);

    await expect(
      useCase.execute({ email: 'nobody@example.com', password: 'whatever' }),
    ).rejects.toThrow(UnauthorizedException);

    // Timing-safety: a compare always happens, even for a non-existent user.
    expect(hasher.compare).toHaveBeenCalledWith('whatever', 'hashed-password');
    expect(encrypter.issueTokenPair).not.toHaveBeenCalled();
  });

  it('rejects with the same generic error when the password is wrong', async () => {
    userRepository.findByEmail.mockResolvedValueOnce({
      email: 'user@example.com',
      userId: 'user-1',
      passwordHash: 'stored-hash',
      createdAt: new Date().toISOString(),
    });
    hasher.compare.mockResolvedValueOnce(false);

    await expect(
      useCase.execute({ email: 'user@example.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
