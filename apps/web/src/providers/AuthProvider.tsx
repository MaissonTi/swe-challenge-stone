import * as React from 'react';
import type { LoginInput } from '@swe-challenge-stone/common';
import { setAccessToken } from '@/lib/session';
import { refreshSessionOnce, setOnSessionExpired } from '@/lib/http-client';
import {
  clearStoredRefreshToken,
  getStoredRefreshToken,
  setStoredRefreshToken,
} from '@/lib/refresh-token-storage';
import { authService } from '@/services/auth.service';
import type { Profile } from '@/types/api';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: SessionStatus;
  user: Profile | null;
  signIn: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<SessionStatus>('loading');
  const [user, setUser] = React.useState<Profile | null>(null);

  const clearSession = React.useCallback(() => {
    clearStoredRefreshToken();
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const establishSession = React.useCallback(async () => {
    try {
      const profile = await authService.me();
      setUser(profile);
      setStatus('authenticated');
    } catch {
      clearSession();
    }
  }, [clearSession]);

  // Bootstrap: a stored refresh token means a previous session may still
  // be alive, but the access token never survives a reload (kept only in
  // memory - see lib/session.ts), so it must be re-derived before any
  // authenticated route renders.
  React.useEffect(() => {
    setOnSessionExpired(clearSession);

    const storedRefreshToken = getStoredRefreshToken();
    if (!storedRefreshToken) {
      setStatus('unauthenticated');
      return;
    }

    // Goes through the same deduped refresh used by the http-client's
    // 401 retry hook (see lib/http-client.ts) rather than calling
    // authService.refresh directly - this effect runs twice under React
    // 18 StrictMode in dev, and the refresh token is single-use, so two
    // independent calls would race and the loser would look like reuse
    // of an already-rotated token.
    refreshSessionOnce()
      .then((tokens) => {
        if (!tokens) {
          clearSession();
          return;
        }
        return establishSession();
      })
      .catch(clearSession);

    return () => setOnSessionExpired(null);
  }, [clearSession, establishSession]);

  const signIn = React.useCallback(
    async (input: LoginInput) => {
      const tokens = await authService.login(input);
      setAccessToken(tokens.accessToken);
      setStoredRefreshToken(tokens.refreshToken);
      await establishSession();
    },
    [establishSession],
  );

  const signOut = React.useCallback(async () => {
    const refreshToken = getStoredRefreshToken() ?? undefined;
    try {
      await authService.logout(refreshToken);
    } catch {
      // Best-effort: even if the API call fails, the local session is
      // cleared below so the user is signed out client-side regardless.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, user, signIn, signOut }),
    [status, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
