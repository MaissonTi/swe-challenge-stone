import type { LoginInput, RegisterInput } from '@swe-challenge-stone/common';
import { httpClient, type TokenPair } from '@/lib/http-client';
import type { Profile } from '@/types/api';

export const authService = {
  register(input: RegisterInput): Promise<void> {
    return httpClient.post('auth/register', input).then(() => undefined);
  },

  login(input: LoginInput): Promise<TokenPair> {
    return httpClient
      .post<TokenPair>('auth/login', input)
      .then((res) => res.data);
  },

  refresh(refreshToken: string): Promise<TokenPair> {
    return httpClient
      .post<TokenPair>('auth/refresh', { refreshToken })
      .then((res) => res.data);
  },

  logout(refreshToken?: string): Promise<void> {
    return httpClient
      .post('auth/logout', { refreshToken })
      .then(() => undefined);
  },

  me(): Promise<Profile> {
    return httpClient.get<Profile>('auth/me').then((res) => res.data);
  },
};
