import { AuthController } from '@/presentation/http/controllers/auth.controller';
import { UserNotFoundError } from '@/domain/errors/user-not-found.error';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  function makeUseCases() {
    return {
      registerUserUseCase: { execute: jest.fn() },
      loginUseCase: { execute: jest.fn() },
      refreshTokenUseCase: { execute: jest.fn() },
      logoutUseCase: { execute: jest.fn() },
      getProfileUseCase: { execute: jest.fn() },
    };
  }

  function makeController(useCases: ReturnType<typeof makeUseCases>) {
    return new AuthController(
      useCases.registerUserUseCase as any,
      useCases.loginUseCase as any,
      useCases.refreshTokenUseCase as any,
      useCases.logoutUseCase as any,
      useCases.getProfileUseCase as any,
    );
  }

  it('register: delegates to the use case with the DTO', async () => {
    const useCases = makeUseCases();
    const controller = makeController(useCases);

    await controller.register({
      email: 'user@example.com',
      password: 'Password1',
    } as any);

    expect(useCases.registerUserUseCase.execute).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'Password1',
    });
  });

  it('login: returns the access/refresh pair from the use case', async () => {
    const useCases = makeUseCases();
    useCases.loginUseCase.execute.mockResolvedValueOnce({
      accessToken: 'a',
      refreshToken: 'r',
      accessJti: 'aj',
      refreshJti: 'rj',
      familyId: 'f',
    });
    const controller = makeController(useCases);

    const result = await controller.login({
      email: 'user@example.com',
      password: 'Password1',
    } as any);

    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('refresh: returns the new access/refresh pair from the use case', async () => {
    const useCases = makeUseCases();
    useCases.refreshTokenUseCase.execute.mockResolvedValueOnce({
      accessToken: 'a2',
      refreshToken: 'r2',
      accessJti: 'aj2',
      refreshJti: 'rj2',
      familyId: 'f',
    });
    const controller = makeController(useCases);

    const result = await controller.refresh({ refreshToken: 'r' } as any);

    expect(result).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
  });

  it('logout: forwards the current user jti/exp and the optional refresh token', async () => {
    const useCases = makeUseCases();
    const controller = makeController(useCases);
    const user = {
      sub: 'user-1',
      jti: 'access-jti',
      familyId: 'family-1',
      type: 'access' as const,
      iat: 1000,
      exp: 2000,
    };

    await controller.logout(user, { refreshToken: 'r' } as any);

    expect(useCases.logoutUseCase.execute).toHaveBeenCalledWith({
      accessJti: 'access-jti',
      accessExp: 2000,
      refreshToken: 'r',
    });
  });

  it('me: returns the profile for the current user', async () => {
    const useCases = makeUseCases();
    useCases.getProfileUseCase.execute.mockResolvedValueOnce({
      userId: 'user-1',
      email: 'user@example.com',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    const controller = makeController(useCases);
    const user = {
      sub: 'user-1',
      jti: 'access-jti',
      familyId: 'family-1',
      type: 'access' as const,
      iat: 1000,
      exp: 2000,
    };

    const result = await controller.me(user);

    expect(useCases.getProfileUseCase.execute).toHaveBeenCalledWith({
      userId: 'user-1',
    });
    expect(result).toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('me: translates UserNotFoundError into an authentication error', async () => {
    const useCases = makeUseCases();
    useCases.getProfileUseCase.execute.mockRejectedValueOnce(
      new UserNotFoundError(),
    );
    const controller = makeController(useCases);
    const user = {
      sub: 'ghost',
      jti: 'access-jti',
      familyId: 'family-1',
      type: 'access' as const,
      iat: 1000,
      exp: 2000,
    };

    await expect(controller.me(user)).rejects.toThrow(UnauthorizedException);
  });
});
