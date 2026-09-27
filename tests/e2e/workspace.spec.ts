import { test, expect } from '@playwright/test';
test('workspace UI: real spreadsheet worker → review → import → compose → draft report', async ({
  page,
  context,
}) => {
  test.skip(
    !!process.env.E2E_BASE_URL,
    'Mocked UI checks only run against the local test fixture.',
  );
  const user = '11111111-1111-4111-8111-111111111111',
    campaignId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    importId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const jwt = [
    { alg: 'HS256', typ: 'JWT' },
    { sub: user, aud: 'authenticated', role: 'authenticated', exp: expires },
    'test-signature',
  ]
    .map((v, i) => (i === 2 ? v : Buffer.from(JSON.stringify(v)).toString('base64url')))
    .join('.');
  const session = {
    access_token: jwt,
    refresh_token: 'test-refresh',
    expires_at: expires,
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: user, email: 'tester@acme.example' },
  };
  await context.addCookies([
    {
      name: 'sb-127-auth-token',
      value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
      domain: 'localhost',
      path: '/',
    },
  ]);
  const contacts = [
    {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'first@acme.org',
      name: 'First',
      status: 'active',
      created_at: new Date().toISOString(),
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      email: 'second@acme.org',
      name: 'Second',
      status: 'active',
      created_at: new Date().toISOString(),
    },
  ];
  let imported: Record<string, unknown> | null = null,
    saved: Record<string, unknown> | null = null;
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method();
    let response: unknown = { items: [], count: 0 };
    if (path === '/api/contacts') response = { items: contacts, count: 2 };
    if (path === '/api/settings')
      response = { name: 'Test User', email: 'tester@acme.example', send_rate: 1, timezone: 'UTC' };
    if (path === '/api/settings/senders')
      response = {
        items: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            from_name: 'Community Team',
            from_email: 'hello@acme.org',
            reply_to: 'reply@acme.org',
            verified: true,
            is_default: true,
          },
        ],
        count: 1,
      };
    if (path === '/api/templates')
      response = {
        items: [
          {
            id: '66666666-6666-4666-8666-666666666666',
            name: 'Welcome',
            subject: 'Welcome aboard',
            body_html: '<h1>Hello!</h1><p>Welcome to our community.</p>',
            body_text: 'Welcome',
            category: 'confirmation',
          },
        ],
        count: 1,
      };
    if (path === '/api/imports' && method === 'POST') {
      imported = req.postDataJSON();
      response = { id: importId };
    }
    if (path === `/api/imports/${importId}`)
      response = {
        id: importId,
        filename: 'recipients.csv',
        total_rows: 5,
        unique_recipients: 2,
        duplicates_removed: 1,
        invalid_entries: 1,
        items: contacts.map((c) => ({
          contact_id: c.id,
          contacts: c,
          source: { sheet: 'Sheet1', column: 'A', row: 2 },
        })),
        count: 2,
      };
    if (path === '/api/campaigns' && method === 'POST') {
      saved = req.postDataJSON();
      response = { id: campaignId };
    }
    if (path === `/api/campaigns/${campaignId}/status`)
      response = {
        ...saved,
        id: campaignId,
        status: 'draft',
        created_at: new Date().toISOString(),
        total_recipients: 2,
        sent_count: 0,
        stats: { queued: 0, sending: 0, sent: 0, delivered: 0, failed: 0, bounced: 0 },
      };
    await route.fulfill({ json: response });
  });
  await page.goto('/imports/new');
  await expect(page.getByRole('heading', { name: 'Import contacts', exact: true })).toBeVisible();
  await page
    .getByLabel('Upload spreadsheet')
    .setInputFiles({
      name: 'recipients.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Email\nfirst@acme.org\nFIRST@acme.org\nsecond@acme.org\nbad@@acme.org'),
    });
  await expect(page.getByRole('button', { name: 'Import 2 recipients' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/import-review.png', fullPage: true });
  await page.getByRole('button', { name: 'Import 2 recipients' }).click();
  await expect(page).toHaveURL(new RegExp('/imports/' + importId));
  expect(imported).toMatchObject({
    recipients: [{ email: 'first@acme.org' }, { email: 'second@acme.org' }],
  });
  await page.goto('/campaigns/new');
  await page.getByLabel('Campaign name').fill('Community welcome');
  await page.getByRole('button', { name: 'Select all in source' }).click();
  await expect(page.getByText('2 recipients selected')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Load template' }).click();
  await page.getByRole('button', { name: 'Welcome Welcome aboard' }).click();
  await expect(page.getByLabel(/Subject ·/)).toHaveValue('Welcome aboard');
  await expect(page.locator('.tiptap')).toContainText('Welcome to our community.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.locator('iframe').contentFrame().getByText('Welcome to our community.'),
  ).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/campaign-preview.png', fullPage: true });
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page).toHaveURL(new RegExp('/campaigns/' + campaignId));
  expect(saved).toMatchObject({
    name: 'Community welcome',
    subject: 'Welcome aboard',
    contact_ids: contacts.map((c) => c.id),
    from_name: 'Community Team',
  });
  await expect(page.getByText('draft', { exact: true })).toBeVisible();
});
