import { expect, test } from '@playwright/test';
import { apiAs, signIn } from './helpers';

test('customer sees their home, payments and downloads a receipt', async ({ page }) => {
  await signIn(page, 'customer');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Amit');
  await expect(page.getByLabel('Construction progress')).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Payments' }).click();
  await page.getByRole('tab', { name: /Receipts/ }).click();
  const first = page.getByRole('button', { name: /Download receipt/ }).first();
  const [download] = await Promise.all([page.waitForEvent('download'), first.click()]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const path = await download.path();
  expect(path).toBeTruthy();
});

test('customer only ever sees their own data', async ({ page }) => {
  await signIn(page, 'customer');
  // Staff screens are not part of the customer app.
  await page.goto('/customers/1');
  await expect(page).toHaveURL(/\/home$/);
  await page.goto('/leads');
  await expect(page).toHaveURL(/\/home$/);

  const customer = await apiAs('customer');
  const accounts = await apiAs('accounts');
  try {
    const portal = await (await customer.get('/api/portal')).json();
    expect(portal.customer.name).toBe('Amit Sharma');
    const own = new Set<number>(portal.transactions.map((t: { id: number }) => t.id));

    expect((await customer.get('/api/customers')).status()).toBe(403);
    expect((await customer.get('/api/leads')).status()).toBe(403);

    const all = await (await accounts.get('/api/transactions?limit=100')).json();
    const other = all.data.find((t: { id: number; customer_id: number }) => !own.has(t.id) && t.customer_id !== portal.customer.id);
    expect(other).toBeTruthy();
    expect((await customer.get(`/api/transactions/${other.id}/receipt.pdf`)).status()).toBe(403);
  } finally {
    await customer.dispose();
    await accounts.dispose();
  }
});

test('customer raises a request and sees it listed', async ({ page }) => {
  await signIn(page, 'customer');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Requests' }).click();
  await expect(page.getByText('Site visit', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'New request' }).click();
  const sheet = page.getByRole('dialog', { name: 'New request' });
  await sheet.getByLabel('Subject').fill('Parking allotment');
  await sheet.getByLabel('Details').fill('Which parking slot is allotted to my villa?');
  await sheet.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('Request sent')).toBeVisible();
  await expect(page.getByText('Parking allotment')).toBeVisible();
});

test('the demo server offers one-tap demo logins on the sign-in screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Customer', exact: true }).click();
  await expect(page.getByLabel('Email')).toHaveValue('customer@demo.com');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});
