import { test, expect } from '@playwright/test';
test('marketing page and responsive signup navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/landing.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('link', { name: 'Get Started', exact: true }).first().click();
  await expect(page).toHaveURL(/\/signup/);
});
test('protected screens require authentication', async ({ page }) => {
  await page.goto('/automations');
  await expect(page).toHaveURL(/\/login\?redirectTo=/);
  await expect(page.getByText('Instant Demo Preview')).toHaveCount(0);
});
test('API, worker and webhook reject unauthorized calls', async ({ request }) => {
  expect((await request.get('/api/contacts')).status()).toBe(401);
  expect(
    (
      await request.post('/api/contacts', {
        data: { email: 'someone@acme.org' },
        headers: { origin: 'https://untrusted.invalid' },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get('/api/jobs')).status()).toBe(401);
  expect([400, 503]).toContain((await request.post('/api/webhooks/resend', { data: {} })).status());
});
test('authenticated import, review, contacts, compose and draft', async ({ page }) => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    'Set credentials for a dedicated test account with migrations applied.',
  );
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(process.env.E2E_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page
    .getByRole('button', { name: /sign in/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/imports/new');
  await page.getByLabel('Upload spreadsheet').setInputFiles({
    name: 'e2e.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Email\nfirst@acme.org\nFIRST@acme.org\nsecond@acme.org\nbad@@acme.org'),
  });
  await expect(page.getByRole('button', { name: 'Import 2 recipients' })).toBeVisible();
  await page.getByRole('button', { name: 'Import 2 recipients' }).click();
  await expect(page).toHaveURL(/\/imports\/[a-f0-9-]+/);
  await page.goto('/campaigns/new');
  await page.getByLabel('Campaign name').fill('E2E draft ' + Date.now());
  await page.getByRole('button', { name: 'Select all in source' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(/Subject ·/).fill('E2E subject');
  await page.locator('.tiptap').fill('Hello from the end-to-end test');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page).toHaveURL(/\/campaigns\/[a-f0-9-]+/);
  await expect(page.getByText('draft', { exact: true })).toBeVisible();
});
