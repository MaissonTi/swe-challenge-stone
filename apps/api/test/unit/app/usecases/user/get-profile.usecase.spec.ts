import { GetProfileUseCase } from '@/app/usecases/user/get-profile.usecase';
import { UserNotFoundError } from '@/domain/errors/user-not-found.error';
import { makeUserRepositoryMock } from '../../../../mocks/user-repository.mock';

describe('GetProfileUseCase', () => {
  let userRepository: ReturnType<typeof makeUserRepositoryMock>;
  let useCase: GetProfileUseCase;

  beforeEach(() => {
    userRepository = makeUserRepositoryMock();
    useCase = new GetProfileUseCase(userRepository);
  });

  it('returns the profile without the password hash', async () => {
    userRepository.findById.mockResolvedValueOnce({
      userId: 'user-1',
      email: 'user@example.com',
      passwordHash: 'hashed',
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    const result = await useCase.execute({ userId: 'user-1' });

    expect(result).toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws UserNotFoundError when the user does not exist', async () => {
    userRepository.findById.mockResolvedValueOnce(null);

    await expect(useCase.execute({ userId: 'ghost' })).rejects.toThrow(
      UserNotFoundError,
    );
  });
});
