# Deployment and operations

The source and deployment configuration are included. Creating cloud projects, applying migrations to an existing account, setting secrets, verifying DNS, and enabling monitoring must be completed in your infrastructure.

## Supabase

1. Create a Supabase project. For a new database, run `supabase/schema.sql` once in the SQL editor. For an existing Phase 1 database, **do not rerun schema.sql**.
2. Apply every file in `supabase/migrations/` in numerical order, once. Each migration is transactional. Back up an existing production database first.
3. Enable email authentication and optionally Google OAuth. Set the site URL to your production origin. Add `/auth/callback` on that origin and localhost to the allowed redirect URLs.
4. Migrations create the private `campaign-attachments` bucket and add an automatic starter-template signup trigger. Existing users can click **Add starter templates**.
5. Keep the service-role key server-side. Application writes use authenticated server routes, validated ownership, and service-only transactional RPCs. Browser clients retain RLS-scoped reads and have no table mutation privileges. Do not restore broad table/function grants.

## Resend

1. Add and verify your exact sending domain in Resend. Publish the provider-supplied SPF/DKIM records at your DNS provider and configure DMARC appropriate for your domain.
2. Each user can enter a Resend API key in Settings → Provider. It must support sending and reading domains. Keys are encrypted with AES-256-GCM using the server's `PROVIDER_KEY_ENCRYPTION_KEY`.
3. Add a sender in Settings → Senders, click **Check verification**, then optionally make it default. Users cannot self-assert verification.
4. Create a Resend webhook using the URL shown in Settings → Provider (`/api/webhooks/resend?user=USER_UUID`). Subscribe to `email.delivered`, `email.bounced`, `email.complained`, and `email.failed`. Store its signing secret in that user's Provider settings.
5. For a single-owner deployment, `RESEND_API_KEY`, `SERVER_SENDER_USER_ID`, and `RESEND_WEBHOOK_SECRET` can provide a server-managed connection. The unqualified `/api/webhooks/resend` endpoint is scoped to that owner. Other users must connect their own keys.
6. Start with a test email to your account. Check live provider quotas; the application's rate setting does not increase provider allowances.

Never put API keys or the encryption key in a `NEXT_PUBLIC_` variable. Keep an encrypted backup of the encryption key; rotating it without re-encrypting existing records makes stored secrets unreadable.

## Vercel

1. Import the GitHub repository. Its root is the Next.js app. Use Node.js 22.12+ or a newer supported LTS version.
2. Set the variables from `.env.example` in the project settings. `NEXT_PUBLIC_APP_URL` must exactly match the canonical production origin for mutation origin checks. Add separate variables for preview environments if used.
3. Deploy and confirm `npm run build` succeeds.
4. `vercel.json` calls `/api/jobs` every minute. The deployment needs a hosting plan supporting this frequency and the route's 60-second duration. An external scheduler can instead send `GET /api/jobs` with `Authorization: Bearer CRON_SECRET` every minute. Never expose this secret to the browser.
5. Enable Vercel Analytics in the dashboard. The application mounts the analytics client only on Vercel.
6. Configure production OAuth callback and webhook URLs before sending.

## Queue operation

Send requests commit the queue before returning. Sending happens only when the authenticated worker runs; keeping a browser tab open is unnecessary. Scheduled campaigns and workflow steps share the worker. Each queue record maps to one recipient and one stable provider idempotency key.

The worker uses a five-minute global lease, bounded batches, row locks with `SKIP LOCKED`, a ten-minute stale-delivery lease, and a 45-second processing budget. It observes server and user send rates. Timeouts, 429s, and 5xx responses receive at most three retries with 1/5/30-second minimum backoff; cron cadence may make retries later. Permanent errors terminate the item.

After an interruption longer than 23 hours from the first attempt, uncertain deliveries are marked failed for manual reconciliation rather than blindly retried outside the provider idempotency window. Check the provider record before duplicating such a campaign. Never reset these rows directly to queued without reconciliation.

Webhook events are signature-verified, owner-scoped, and deduplicated. Events that arrive before provider acceptance is persisted are replayed by the worker. Complaints and bounces suppress contacts and cannot be overwritten by a delayed delivery event. Reimporting a suppressed contact preserves its status.

The MVP uses one global worker: throughput is deliberately bounded. For sustained high volume, move processing to a dedicated queue service, retaining the transactional enqueue and idempotency semantics. The current UI limits campaigns/imports to 10,000 recipients and attachments to 10 MB. Text, images and PDF attachments are supported; malware scanning is not included.

## Monitoring and recovery

- Configure an external uptime monitor against the homepage and alert on failures.
- Monitor Vercel job errors/duration and Supabase/Postgres errors. Alert on campaigns stuck in `sending`, old queued entries, and automation `error_message` values.
- Watch Resend delivery failures, complaint rates, quotas, and webhook retries.
- A paused campaign stops future claims; an already claimed email may finish. Paused workflows stop future steps; emails already enqueued remain independent campaigns.
- On queue failure, fix the underlying configuration and let the worker reclaim eligible stale leases. Known failed campaigns can be duplicated after reviewing recipients and suppression.
- Test database backup/restore and preserve provider-key encryption secrets separately.
- Create a demo account through normal signup and import `docs/sample-contacts.csv` in a non-production workspace. These reserved `.example` addresses are sample data, not live delivery targets. Do not enable its campaigns for sending.

## Release checks

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e`. Set `E2E_EMAIL`/`E2E_PASSWORD` for the optional authenticated browser flow against a dedicated migrated test environment. That flow saves a draft and sends no real emails. A final live smoke test should use only an inbox you control: import → compose → send test → confirm webhook → verify report. Live sending, DNS, OAuth, storage policy behavior on hosted Supabase, and production cron must be verified after provisioning.

The local browser suite starts an isolated authentication fixture on port 54329 and the application on port 3100. Its workspace test mocks API responses but runs the real spreadsheet worker, editor, navigation and draft UI. Set E2E_BASE_URL to test an existing deployment; the fixture test then skips, and the dedicated-account flow can run with E2E_EMAIL/E2E_PASSWORD. No test bypass is present in application routes.
