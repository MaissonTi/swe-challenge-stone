import { RegisterUserUseCase } from '@/app/usecases/user/register-user.usecase';
import { EmailAlreadyRegisteredError } from '@/domain/errors/email-already-registered.error';
import { makeHasherMock } from '../../../../mocks/hasher.mock';
import { makeUserRepositoryMock } from '../../../../mocks/user-repository.mock';

describe('RegisterUserUseCase', () => {
  let userRepository: ReturnType<typeof makeUserRepositoryMock>;
  let hasher: ReturnType<typeof makeHasherMock>;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    userRepository = makeUserRepositoryMock();
    hasher = makeHasherMock();
    useCase = new RegisterUserUseCase(userRepository, hasher);
  });

  it('hashes the password and creates the user with a normalized email', async () => {
    await useCase.execute({ email: 'User@Example.com', password: 'Password1' });

    expect(hasher.hash).toHaveBeenCalledWith('Password1');
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        passwordHash: 'hashed-password',
      }),
    );
  });

  it('swallows EmailAlreadyRegisteredError without throwing (no enumeration leak)', async () => {
    userRepository.create.mockRejectedValueOnce(
      new EmailAlreadyRegisteredError(),
    );

    await expect(
      useCase.execute({ email: 'user@example.com', password: 'Password1' }),
    ).resolves.toBeUndefined();
  });

  it('propagates unexpected errors', async () => {
    userRepository.create.mockRejectedValueOnce(new Error('boom'));

    await expect(
      useCase.execute({ email: 'user@example.com', password: 'Password1' }),
    ).rejects.toThrow('boom');
  });
});
