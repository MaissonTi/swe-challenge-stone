import { expect, test } from '@playwright/test';
import { uniqueEmail, uniqueProductName } from './helpers';

/**
 * Covers specs/web-spa: Sign Up, Sign In, Product Catalog Listing,
 * Product Management (create/deactivate/delete).
 *
 * The listing endpoint is cache-aside, but every product write now
 * invalidates cached listings (see specs/products: "Read-Path Caching"
 * and the generation-scoped `buildCacheKey` in
 * `list-products.usecase.ts`), so re-querying the *same* filter right
 * after a create/deactivate/delete reflects that write - no need to
 * work around it with a distinct prefix.
 *
 * A deactivated product is fully excluded from the default (active-only)
 * listing, so it has no reachable row to click "Delete" on afterward -
 * deactivation and deletion are exercised on two separate products, the
 * way a real user would encounter each action.
 */

async function signUpAndSignIn(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) {
  await page.goto('/auth/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/auth\/signin/);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/products/);
}

async function createProduct(
  page: import('@playwright/test').Page,
  name: string,
) {
  await page.getByRole('button', { name: 'New product' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'ELECTRONICS' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/products$/);
}

async function searchByPrefix(
  page: import('@playwright/test').Page,
  prefix: string,
) {
  await page.getByPlaceholder('Name prefix...').fill(prefix);
  await page.getByRole('button', { name: 'Search' }).click();
}

test('create then deactivate a product removes it from the default listing', async ({
  page,
}) => {
  const email = uniqueEmail();
  const productName = uniqueProductName();

  await signUpAndSignIn(page, email, 'Password1');
  await createProduct(page, productName);

  await searchByPrefix(page, productName);
  await expect(page.getByText(productName)).toBeVisible();

  await page
    .locator('tr', { hasText: productName })
    .getByRole('button', { name: 'Deactivate' })
    .click();

  // Deactivation invalidated cached listings, so re-querying the same
  // prefix reflects that.
  await searchByPrefix(page, productName);
  await expect(page.getByText(productName)).not.toBeVisible();
});

test('create then delete a product removes it permanently', async ({
  page,
}) => {
  const email = uniqueEmail();
  const productName = uniqueProductName();

  await signUpAndSignIn(page, email, 'Password1');
  await createProduct(page, productName);

  await searchByPrefix(page, productName);
  await expect(page.getByText(productName)).toBeVisible();

  await page
    .locator('tr', { hasText: productName })
    .getByRole('button', { name: 'Delete' })
    .click();

  // Deletion invalidated cached listings, so re-querying the same
  // prefix reflects that.
  await searchByPrefix(page, productName);
  await expect(page.getByText(productName)).not.toBeVisible();
});
