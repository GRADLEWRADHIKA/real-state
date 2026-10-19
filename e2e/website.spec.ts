import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('signed out, the app opens on the website and leads to sign-in and back', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Homes made for the way Lucknow lives/ })).toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Website' }).getByRole('link', { name: 'Properties' }).click();
  await expect(page).toHaveURL(/\/homes$/);
  await page.locator('a[href^="/homes/"]').first().click();
  await expect(page).toHaveURL(/\/homes\/[^/]+$/);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Website' }).getByRole('link', { name: 'Sign in' }).click();
  await expect(page.getByLabel('Email')).toBeVisible();
  await page.getByRole('link', { name: 'Browse our homes' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Homes made for the way Lucknow lives/ })).toBeVisible();
});

test('signed in, a shared property link opens in the app with a way back', async ({ page }) => {
  await signIn(page, 'sales');
  await page.goto('/homes');
  await page.locator('a[href^="/homes/"]').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Website' }).getByRole('link', { name: 'Back to the app' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});
