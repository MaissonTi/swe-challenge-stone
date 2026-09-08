import type MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REFRESH_URL = /\/auth\/refresh$/;
const PRODUCTS_URL = /\/products$/;
const ME_URL = /\/auth\/me$/;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Both the module-level `axios` (used by the module's plain refresh
 * call) and the `httpClient` instance need to resolve to the SAME axios
 * module for a single MockAdapter to cover both - that's why axios is
 * re-imported inside each test, after vi.resetModules(), and the mock
 * is installed before http-client is imported (http-client calls
 * axios.create() at module load time).
 */
async function loadHarness() {
  const axios = (await import('axios')).default;
  const { default: AxiosMockAdapter } = await import('axios-mock-adapter');
  const mock = new AxiosMockAdapter(axios);
  const mod = await import('@/lib/http-client');
  return { mock, ...mod };
}

describe('httpClient', () => {
  let activeMock: MockAdapter | null = null;

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    activeMock?.restore();
    activeMock = null;
  });

  it('retries the original request exactly once after a successful silent refresh', async () => {
    localStorage.setItem('stone.refreshToken', 'old-refresh-token');
    const { mock, httpClient } = await loadHarness();
    activeMock = mock;

    mock
      .onPost(REFRESH_URL)
      .reply(200, { accessToken: 'new-access', refreshToken: 'new-refresh' });

    let productsCallCount = 0;
    mock.onGet(PRODUCTS_URL).reply(() => {
      productsCallCount += 1;
      return productsCallCount === 1 ? [401, null] : [200, { items: [] }];
    });

    const result = await httpClient.get('products').then((res) => res.data);

    expect(result).toEqual({ items: [] });
    expect(productsCallCount).toBe(2);
  });

  it('never retries the refresh call itself, and does not loop on a second 401', async () => {
    localStorage.setItem('stone.refreshToken', 'stale-refresh-token');
    const { mock, httpClient } = await loadHarness();
    activeMock = mock;

    let refreshCallCount = 0;
    let meCallCount = 0;
    mock.onPost(REFRESH_URL).reply(() => {
      refreshCallCount += 1;
      return [401, null];
    });
    mock.onGet(ME_URL).reply(() => {
      meCallCount += 1;
      return [401, null];
    });

    await expect(httpClient.get('auth/me')).rejects.toBeTruthy();

    expect(refreshCallCount).toBe(1);
    expect(meCallCount).toBe(1);
  });

  it('dedupes concurrent refresh attempts into a single network call', async () => {
    // This is exactly the race condition that caused a real bug during
    // manual verification: React 18's StrictMode invokes AuthProvider's
    // bootstrap effect twice, and the refresh token is single-use - two
    // concurrent calls would collide (see design.md, "Bug found during
    // verification").
    localStorage.setItem('stone.refreshToken', 'shared-refresh-token');
    const { mock, refreshSessionOnce } = await loadHarness();
    activeMock = mock;

    let refreshCallCount = 0;
    mock.onPost(REFRESH_URL).reply(async () => {
      refreshCallCount += 1;
      await delay(10);
      return [200, { accessToken: 'a', refreshToken: 'r' }];
    });

    const [first, second] = await Promise.all([
      refreshSessionOnce(),
      refreshSessionOnce(),
    ]);

    expect(refreshCallCount).toBe(1);
    expect(first).toEqual(second);
  });

  it('does not attempt a refresh when no refresh token is stored', async () => {
    const { mock, httpClient } = await loadHarness();
    activeMock = mock;

    mock.onGet(PRODUCTS_URL).reply(401);
    mock
      .onPost(REFRESH_URL)
      .reply(200, { accessToken: 'x', refreshToken: 'y' });

    await expect(httpClient.get('products')).rejects.toBeTruthy();

    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.post).toHaveLength(0);
  });
});
