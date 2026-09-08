/**
 * Holds the access token in memory only - never persisted, never
 * survives a reload (see specs/web-spa: "Session Token Handling"). Kept
 * outside React so lib/http-client.ts can read/write it without a
 * dependency on the component tree; providers/AuthProvider.tsx is the
 * only other reader/writer, mirroring session state into React.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
