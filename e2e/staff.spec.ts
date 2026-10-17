import { expect, test } from '@playwright/test';
import { osLinks, signIn } from './helpers';

test.describe('sales executive', () => {
  test('signs in, sees my day, opens a lead and logs a call', async ({ page }) => {
    await signIn(page, 'sales');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Rahul');
    await expect(page.getByText('Site visits', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Megha Kapoor/ }).first()).toBeVisible();

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Leads' }).click();
    await page.getByRole('searchbox', { name: 'Search leads' }).fill('Megha');
    await page.getByRole('link', { name: /Megha Kapoor/ }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Megha Kapoor' })).toBeVisible();

    // The call link hands off to the phone's dialler; the log sheet is waiting on return.
    await page.getByRole('main').getByRole('link', { name: 'Call Megha Kapoor' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Log call with Megha Kapoor' });
    await expect(sheet).toBeVisible();
    expect(await osLinks(page)).toEqual(['tel:+919935060218']);
    await sheet.getByLabel('What happened?').fill('Confirmed the 3 PM visit with family');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Call logged')).toBeVisible();
    await expect(page.getByText('Confirmed the 3 PM visit with family')).toBeVisible();
  });

  test('checks in and out of a site visit with an outcome', async ({ page }) => {
    await signIn(page, 'sales');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Visits' }).click();
    await page.getByRole('link', { name: /Megha Kapoor/ }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Megha Kapoor');

    await page.getByRole('button', { name: 'Check in at site' }).click();
    await expect(page.getByText('Checked in with your location')).toBeVisible();
    await expect(page.getByText(/On site since/)).toBeVisible();

    await page.getByRole('button', { name: 'Check out and record outcome' }).click();
    const sheet = page.getByRole('dialog', { name: 'How did the visit go?' });
    await sheet.getByLabel('Very interested').check();
    await sheet.getByLabel('Feedback').fill('Loved the east-facing garden');
    await sheet.getByRole('button', { name: 'Check out' }).click();
    await expect(page.getByText('Visit completed')).toBeVisible();
    await expect(page.getByRole('main').getByText('Completed', { exact: true })).toBeVisible();
    await expect(page.getByText('Loved the east-facing garden')).toBeVisible();

    // The server has the check-in coordinates and the outcome.
    await page.reload();
    await expect(page.getByText('Very interested')).toBeVisible();
    await expect(page.getByText('Checked in', { exact: true })).toBeVisible();
  });

  test('quick add warns about a duplicate phone number', async ({ page }) => {
    await signIn(page, 'sales');
    await page.goto('/leads?new=1');
    const sheet = page.getByRole('dialog', { name: 'New lead' });
    await sheet.getByLabel('Name').fill('Megha K');
    await sheet.getByLabel('Phone').fill('+91 99350 60218');
    await sheet.getByRole('button', { name: 'Add lead' }).click();
    await expect(sheet.getByText('This number is already a lead')).toBeVisible();
    await sheet.getByRole('button', { name: 'Open Megha Kapoor' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Megha Kapoor' })).toBeVisible();
  });

  test('records work offline and replays it in order when back online', async ({ page, context }) => {
    await signIn(page, 'sales');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Leads' }).click();
    await page.getByRole('searchbox', { name: 'Search leads' }).fill('Aman Rizvi');
    await page.getByRole('link', { name: /Aman Rizvi/ }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Aman Rizvi' })).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByText('Offline. Showing saved data.')).toBeVisible();

    await page.getByRole('button', { name: 'Note', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Note').fill('Prefers a corner plot (written offline)');
    await page.getByRole('dialog').getByRole('button', { name: 'Add note' }).click();
    await expect(page.getByTestId('pending-count')).toHaveText('1');

    await page.getByRole('button', { name: 'Log a call or meeting' }).click();
    const log = page.getByRole('dialog');
    await log.getByRole('tab', { name: 'WhatsApp' }).click();
    await log.getByLabel('What happened?').fill('Sent the plot map (offline)');
    await log.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('pending-count')).toHaveText('2');

    // Saved on the device, so it survives the app being closed (the phone serves the app itself).
    const saved = await page.evaluate(() => Object.entries(localStorage).find(([k]) => k.startsWith('ef_offline_queue:'))?.[1]);
    expect(JSON.parse(saved ?? '[]').map((i: { kind: string }) => i.kind)).toEqual(['note', 'log-contact']);

    await context.setOffline(false);
    await expect(page.getByText('2 offline changes synced')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('pending-count')).toHaveCount(0);
    await expect(page.getByText('Prefers a corner plot (written offline)')).toBeVisible();
    await expect(page.getByText('Sent the plot map (offline)')).toBeVisible();
  });
});

test('administrators get a read-only view', async ({ page }) => {
  await signIn(page, 'admin');
  await expect(page.getByText('Administrators can view everything here.')).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Leads' }).click();
  await expect(page.getByRole('button', { name: 'Add lead' })).toHaveCount(0);
});
