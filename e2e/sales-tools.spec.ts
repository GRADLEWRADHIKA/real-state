import { expect, test } from '@playwright/test';
import { apiAs, signIn } from './helpers';

/** Sales tools in the app: stuck leads on My day, holding a unit for a buyer, visitor ratings; and the customer's referrals and ratings. */

test('sales sees stuck leads on My day and filters the lead list by them', async ({ page }) => {
  const sales = await apiAs('sales');
  let first: { name: string; idle_days: number };
  try {
    // Scoped by the server: a sales executive only gets their own leads.
    const insights = await (await sales.get('/api/leads/insights?days=7')).json();
    expect(insights.stuck.length).toBeGreaterThan(0);
    first = insights.stuck[0];
  } finally {
    await sales.dispose();
  }

  await signIn(page, 'sales');
  const card = page.locator('section', { has: page.getByRole('heading', { name: /^Needs a call/ }) });
  await expect(card).toBeVisible();
  await expect(card.getByRole('link', { name: new RegExp(`^${first.name}`) })).toBeVisible();
  await expect(card.getByText(`${first.idle_days} days idle`).first()).toBeVisible();
  await expect(card.getByRole('link', { name: `Call ${first.name}` })).toBeVisible();

  await card.getByRole('link', { name: 'See all' }).click();
  await expect(page).toHaveURL(/filter=stuck/);
  await expect(page.getByRole('tab', { name: 'Stuck' })).toHaveAttribute('aria-selected', 'true');
  const row = page.getByRole('link', { name: new RegExp(`^${first.name}`) }).first();
  await expect(row).toBeVisible();
  await expect(row.getByText(`${first.idle_days} days idle`)).toBeVisible();
  await expect(row.getByLabel(/^Score \d+$/)).toBeVisible();

  await row.click();
  await expect(page.getByRole('heading', { level: 1, name: first.name })).toBeVisible();
  await expect(page.getByText('Score', { exact: true })).toBeVisible();
  await expect(page.getByText(`No contact for ${first.idle_days} days`)).toBeVisible();
});

test('sales holds a plot for a buyer and releases it', async ({ page }) => {
  const sales = await apiAs('sales');
  let plot: { id: number; project: string; unit_number: string };
  try {
    const list = await (await sales.get('/api/properties?type=Plot&limit=100')).json();
    plot = list.data.find((p: { status: string }) => p.status === 'Available');
    expect(plot).toBeTruthy();
  } finally {
    await sales.dispose();
  }

  await signIn(page, 'sales');
  await page.goto(`/properties/${plot.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(plot.unit_number);
  // The plot's block has a rate on the price list.
  await expect(page.getByText('Price list', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Hold for buyer' }).click();
  const sheet = page.getByRole('dialog', { name: 'Hold for buyer' });
  await sheet.getByRole('tab', { name: '7 days' }).click();
  await expect(sheet.getByLabel('Days')).toHaveValue('7');
  const buyer = sheet.getByLabel('Buyer');
  await expect(buyer.locator('option')).not.toHaveCount(1);
  const leadName = (await buyer.locator('option').nth(1).textContent())!.replace(/ \(.*\)$/, '');
  await buyer.selectOption({ index: 1 });
  await sheet.getByLabel('Note').fill('Token cheque on Monday');
  await sheet.getByRole('button', { name: 'Hold unit' }).click();

  await expect(page.getByText('On hold for 7 days')).toBeVisible();
  await expect(page.getByText(new RegExp(`On hold for ${leadName} until`))).toBeVisible();
  await expect(page.getByText(/7 days left · by Rahul/)).toBeVisible();
  await expect(page.getByText('Token cheque on Monday')).toBeVisible();
  await expect(page.getByRole('main').getByText('Reserved', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(new RegExp(`On hold for ${leadName} until`))).toBeVisible();
  await page.getByRole('button', { name: 'Release' }).click();
  await expect(page.getByText('Hold released. The unit is available again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hold for buyer' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Available', { exact: true })).toBeVisible();
});

test('sales records the visitor rating for a completed visit', async ({ page }) => {
  const sales = await apiAs('sales');
  let visit: { id: number; lead_name: string };
  try {
    const list = await (await sales.get('/api/site-visits?status=Completed&limit=50')).json();
    visit = list.data.find((v: { status: string }) => v.status === 'Completed');
    expect(visit).toBeTruthy();
  } finally {
    await sales.dispose();
  }

  await signIn(page, 'sales');
  await page.goto(`/site-visits/${visit.id}`);
  await expect(page.getByText('Visitor rating')).toBeVisible();
  await page.getByRole('button', { name: 'Rate visit' }).click();
  const sheet = page.getByRole('dialog', { name: 'Visitor rating' });
  await sheet.getByRole('button', { name: 'Save rating' }).click();
  await expect(page.getByText('Tap a star to rate the visit')).toBeVisible();
  await sheet.getByRole('radio', { name: '4 stars' }).click();
  await expect(sheet.getByRole('radio', { name: '4 stars' })).toHaveAttribute('aria-checked', 'true');
  await sheet.getByLabel('Comment').fill('Loved the park facing plots');
  await sheet.getByRole('button', { name: 'Save rating' }).click();
  await expect(page.getByText('Thanks! Rating saved')).toBeVisible();
  await expect(page.getByText('Rated 4/5 · Loved the park facing plots')).toBeVisible();

  // The rating is on the lead's timeline.
  await page.getByRole('link', { name: /Open lead and timeline/ }).click();
  await expect(page.getByText('Visit rated 4/5')).toBeVisible();
});

test('customer refers a friend and sees the referral listed', async ({ page }) => {
  await signIn(page, 'customer');
  await page.getByRole('link', { name: 'Refer a friend' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Refer a friend' })).toBeVisible();
  // The seeded referral is already listed.
  await expect(page.getByText('Nitin Saxena')).toBeVisible();

  await page.getByRole('button', { name: 'Refer a friend' }).click();
  let sheet = page.getByRole('dialog', { name: 'Refer a friend' });
  await sheet.getByLabel('Friend’s name').fill('Kavita Rao');
  await sheet.getByLabel('Friend’s phone').fill('+91 99887 12345');
  await sheet.getByLabel('Note').fill('Wants a plot near the clubhouse');
  await sheet.getByRole('button', { name: 'Send referral' }).click();
  await expect(page.getByText('Thank you! We will call Kavita Rao soon.')).toBeVisible();
  await expect(sheet).toHaveCount(0);
  const list = page.locator('section', { has: page.getByRole('heading', { name: 'Your referrals' }) });
  await expect(list.getByText('Kavita Rao')).toBeVisible();
  await expect(list.getByText('Received')).toBeVisible();

  // A number the sales team already has: the server's message is shown.
  await page.getByRole('button', { name: 'Refer a friend' }).click();
  sheet = page.getByRole('dialog', { name: 'Refer a friend' });
  await sheet.getByLabel('Friend’s name').fill('Kavita again');
  await sheet.getByLabel('Friend’s phone').fill('+91 99887 12345');
  await sheet.getByRole('button', { name: 'Send referral' }).click();
  await expect(sheet.getByRole('alert')).toHaveText('This number is already with our sales team. Thank you for the referral!');

  await page.reload();
  await expect(page.getByText('Kavita Rao')).toBeVisible();
});

test('customer rates the service from Home and from Profile', async ({ page }) => {
  await signIn(page, 'customer');
  await page.getByRole('button', { name: 'Rate us' }).click();
  let sheet = page.getByRole('dialog', { name: 'Rate us' });
  await sheet.getByRole('radio', { name: '5 stars' }).click();
  await sheet.getByLabel('Comment').fill('Very responsive team');
  await sheet.getByRole('button', { name: 'Send rating' }).click();
  await expect(page.getByText('Thank you for your feedback!')).toBeVisible();
  await expect(sheet).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Profile' }).click();
  await page.getByRole('button', { name: /^Rate us/ }).click();
  sheet = page.getByRole('dialog', { name: 'Rate us' });
  await sheet.getByRole('radio', { name: '3 stars' }).click();
  await sheet.getByRole('button', { name: 'Send rating' }).click();
  await expect(page.getByText('Thank you for your feedback!').first()).toBeVisible();

  const customer = await apiAs('customer');
  try {
    const fb = await (await customer.get('/api/portal/feedback')).json();
    const general = fb.data.filter((f: { kind: string }) => f.kind === 'general').map((f: { rating: number; comment: string | null }) => [f.rating, f.comment]);
    expect(general).toEqual(expect.arrayContaining([[5, 'Very responsive team'], [3, null]]));
  } finally {
    await customer.dispose();
  }
});
