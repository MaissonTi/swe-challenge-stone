/**
 * Refresh token persistence, isolated in its own module so the trade-off
 * it embodies is visible in one place: this is the "Option A" decision
 * (see docs/PRD.md, §4.8 / openspec/changes/add-web-spa/design.md) - the refresh
 * token lives in localStorage and is therefore readable by any script
 * that achieves XSS on this page. The access token never touches this
 * module or any persistent storage (see lib/session.ts).
 */
const REFRESH_TOKEN_KEY = 'stone.refreshToken';

export function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredRefreshToken(token: string): void {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {
    // localStorage unavailable (private mode, blocked storage) - the
    // session simply won't survive a reload. Nothing else to do here.
  }
}

export function clearStoredRefreshToken(): void {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // ignore
  }
}
