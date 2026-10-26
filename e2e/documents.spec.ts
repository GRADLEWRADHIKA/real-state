import { expect, test } from '@playwright/test';
import { apiAs, signIn } from './helpers';

test('accounts scans two pages into one PDF in a customer document section', async ({ page }) => {
  // Two "photos" of paper: screenshots of the sign-in screen stand in for camera pages.
  await page.goto('/login');
  const photo = await page.screenshot({ type: 'jpeg' });

  await signIn(page, 'accounts');
  const api = await apiAs('accounts');
  const customer = (await (await api.get('/api/customers?q=Amit')).json()).data[0];
  await page.goto(`/customers/${customer.id}?tab=documents`);
  await page.getByRole('button', { name: 'Upload or scan to Land records' }).click();

  const sheet = page.getByRole('dialog', { name: 'Add to Land records' });
  await expect(sheet.getByLabel('Document type')).toHaveValue('Khatauni');
  // In a browser the scanner opens the camera through a file input; on the phone it uses the native camera.
  const camera = sheet.locator('input[type=file][accept="image/*"]');
  await camera.setInputFiles({ name: 'page-1.jpg', mimeType: 'image/jpeg', buffer: photo });
  await camera.setInputFiles({ name: 'page-2.jpg', mimeType: 'image/jpeg', buffer: photo });
  await expect(sheet.getByRole('list', { name: 'Scanned pages' }).getByRole('listitem')).toHaveCount(2);
  await sheet.getByRole('button', { name: /Save 2 pages as PDF/ }).click();
  await expect(page.getByText('Scanned 2 pages and saved as PDF')).toBeVisible();

  const land = page.getByRole('region', { name: /Land records/ });
  await expect(land.getByText(/Khatauni \(scan /)).toBeVisible();
  const docs = await (await api.get(`/api/documents?entity_type=customer&entity_id=${customer.id}&doc_type=Khatauni`)).json();
  expect(docs.data[0].mime).toBe('application/pdf');
  await api.dispose();
});

test('a customer can scan their own document from the app', async ({ page }) => {
  await page.goto('/login');
  const photo = await page.screenshot({ type: 'jpeg' });
  await signIn(page, 'customer');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Documents' }).click();
  await page.getByRole('button', { name: 'Upload or scan a document' }).click();
  const sheet = page.getByRole('dialog', { name: 'Upload or scan a document' });
  await sheet.getByLabel('Document type').selectOption('PAN');
  await sheet.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'pan.jpg', mimeType: 'image/jpeg', buffer: photo });
  await sheet.getByRole('button', { name: /Save 1 page as PDF/ }).click();
  await expect(page.getByText('Scanned 1 page and saved as PDF')).toBeVisible();
  await expect(page.getByText(/PAN \(scan /).first()).toBeVisible();
});
