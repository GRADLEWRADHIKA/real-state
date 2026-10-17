import { expect, request, type Page } from '@playwright/test';

export const USERS = {
  sales: ['sales@demo.com', 'Sales@123'],
  accounts: ['accounts@demo.com', 'Accounts@123'],
  customer: ['customer@demo.com', 'Customer@123'],
  admin: ['admin@demo.com', 'Admin@123'],
} as const;

/**
 * On the phone, tel: and sms: links are handed to the dialler / messages app and the WebView stays
 * put. Desktop Chromium instead starts a navigation that never completes, so the tests stand in for
 * the OS hand-off by recording the link and cancelling the navigation.
 */
export async function stubOsLinks(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __osLinks: string[] }).__osLinks = [];
    document.addEventListener(
      'click',
      (e) => {
        const a = (e.target as Element | null)?.closest?.('a[href^="tel:"], a[href^="sms:"], a[href^="geo:"]') as HTMLAnchorElement | null;
        if (!a) return;
        e.preventDefault();
        (window as unknown as { __osLinks: string[] }).__osLinks.push(a.getAttribute('href')!);
      },
      true,
    );
  });
}

export const osLinks = (page: Page) => page.evaluate(() => (window as unknown as { __osLinks: string[] }).__osLinks);

export async function signIn(page: Page, who: keyof typeof USERS) {
  const [email, password] = USERS[who];
  await stubOsLinks(page);
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

/** Direct API session (as the app client) for checks the UI cannot express. */
export async function apiAs(who: keyof typeof USERS) {
  const [email, password] = USERS[who];
  const ctx = await request.newContext({ baseURL: process.env.E2E_API_URL, extraHTTPHeaders: { 'X-EstateFlow-Client': 'app' } });
  const res = await ctx.post('/api/auth/login', { data: { email, password, client: 'app' } });
  expect(res.status()).toBe(200);
  const { accessToken } = await res.json();
  const auth = { Authorization: `Bearer ${accessToken}` };
  return {
    get: (url: string) => ctx.get(url, { headers: auth }),
    dispose: () => ctx.dispose(),
  };
}
