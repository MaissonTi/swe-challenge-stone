import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import {
  clearStoredRefreshToken,
  getStoredRefreshToken,
  setStoredRefreshToken,
} from './refresh-token-storage';
import { getAccessToken, setAccessToken } from './session';

const API_ORIGIN: string =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
// The API's business routes live under /v1 (/health doesn't). Centralize
// the prefix here so service modules can use relative paths.
const API_BASE_URL = `${API_ORIGIN}/v1`;

export type TokenPair = { accessToken: string; refreshToken: string };

let onSessionExpired: (() => void) | null = null;

/** AuthProvider registers a callback here so a failed silent refresh can redirect to sign-in. */
export function setOnSessionExpired(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

let refreshPromise: Promise<TokenPair | null> | null = null;

async function refreshSession(): Promise<TokenPair | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    // Plain axios (not the instance) so the interceptors below never see
    // this call - its 401 is the "refresh failed" signal, not a trigger
    // for another refresh.
    const { data } = await axios.post<TokenPair>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
    );
    setAccessToken(data.accessToken);
    setStoredRefreshToken(data.refreshToken);
    return data;
  } catch {
    return null;
  }
}

/**
 * Guarantees at most one refresh in flight, no matter how many callers
 * ask concurrently - the 401 retry interceptor below AND
 * providers/AuthProvider's bootstrap effect (which React 18's
 * StrictMode invokes twice in dev). Without this dedup, two concurrent
 * calls would read the same not-yet-rotated refresh token; whichever
 * finishes second would look like reuse of an already-rotated token and
 * trigger cascading revocation of the whole session (see
 * specs/user-auth: "Refresh Token Reuse Detection").
 */
export function refreshSessionOnce(): Promise<TokenPair | null> {
  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Marks a request config that's already been retried once after a refresh. */
type RetriableConfig = InternalAxiosRequestConfig & {
  _retriedAfterRefresh?: boolean;
};

export const httpClient = axios.create({ baseURL: API_BASE_URL });

httpClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    if (!original || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // The refresh call's own 401 IS the "refresh failed" signal - never retry it.
    if ((original.url ?? '').endsWith('/auth/refresh')) {
      return Promise.reject(error);
    }

    // Limits retries to exactly one per original request.
    if (original._retriedAfterRefresh) {
      return Promise.reject(error);
    }

    const refreshed = await refreshSessionOnce();
    if (!refreshed) {
      clearStoredRefreshToken();
      setAccessToken(null);
      onSessionExpired?.();
      return Promise.reject(error);
    }

    // The request interceptor re-reads the (now rotated) access token
    // from the session on this retry, so no manual header tweak is
    // needed.
    original._retriedAfterRefresh = true;
    return httpClient(original);
  },
);
