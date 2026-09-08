import { expect, test } from '@playwright/test';
import { uniqueEmail } from './helpers';

/** Covers specs/web-spa: Protected Route Access, Session Token Handling, Sign Out. */

test('an unauthenticated visitor is redirected to sign-in', async ({
  page,
}) => {
  await page.goto('/products');
  await expect(page).toHaveURL(/\/auth\/signin/);

  await page.goto('/profile');
  await expect(page).toHaveURL(/\/auth\/signin/);
});

test('an invalid stored refresh token redirects to sign-in on reload', async ({
  page,
}) => {
  const email = uniqueEmail();
  const password = 'Password1';

  await page.goto('/auth/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/auth\/signin/);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/products/);

  // Simulate an expired/revoked refresh token (e.g. after the 7-day
  // window, or a reuse-detection revocation) by corrupting the stored
  // value directly, then reloading - the bootstrap silent-refresh should
  // fail and clear the session rather than leaving a half-authenticated
  // page rendered.
  await page.evaluate(() =>
    localStorage.setItem('stone.refreshToken', 'not-a-real-token'),
  );
  await page.reload();

  await expect(page).toHaveURL(/\/auth\/signin/);
});

test('sign out clears the session and further protected navigation redirects again', async ({
  page,
}) => {
  const email = uniqueEmail();
  const password = 'Password1';

  await page.goto('/auth/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/auth\/signin/);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/products/);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/auth\/signin/);

  const storedRefreshToken = await page.evaluate(() =>
    localStorage.getItem('stone.refreshToken'),
  );
  expect(storedRefreshToken).toBeNull();

  await page.goto('/products');
  await expect(page).toHaveURL(/\/auth\/signin/);
});
