## Personal local mode

Set `NEXT_PUBLIC_LOCAL_MODE=true`, `LOCAL_LOGIN_EMAIL`, `LOCAL_LOGIN_PASSWORD`, and a random `LOCAL_SESSION_SECRET` (at least 32 characters) in `.env.local`. Keep the existing encryption key and cron secret. Restart `npm run dev`, open http://localhost:3000/login, and use those credentials. Google login and public signup are hidden in this mode. Supabase credentials are not needed.

Contacts, templates, imports, campaigns, settings, and attachments are saved in `.local-data/` on this computer. Stop the app before backing up that directory, and preserve `.env.local` separately: its encryption key is needed to read saved provider credentials. Local mode supports one running server process; run it on a persistent computer, not a serverless host. Do not run development and production servers against the same directory simultaneously.

Real email delivery still requires a Resend key and verified sender in Settings. The local worker checks scheduled work every 15 seconds while the app is running. Jobs wait while the app is closed; delivery webhooks require a publicly reachable URL. Changing the local session secret signs out existing sessions. Local data is separate from any existing Supabase data.

# MailAutomator

A Next.js application for turning messy spreadsheets into reviewed contact lists, writing email campaigns, and delivering individual messages through a persistent queue.

The project implements the spreadsheet engine, contact/group management, rich-text composer, templates, scheduled delivery, provider webhooks, campaign analytics, and multi-step workflows from Phases 2�7. Phase 8 includes security hardening, tests, documentation and deployment configuration. Live cloud provisioning and production validation require your Supabase, Resend and hosting accounts.

## Get started

```sh
npm ci
```

Copy `.env.example` to `.env.local`, fill in the Supabase public and service-role keys, set the application URL, and generate the encryption and cron secrets. For a new database, apply `supabase/schema.sql` once, then every numbered migration in `supabase/migrations/`. If Phase 1 is already deployed, apply only the migrations.

```sh
npm run dev
```

Open http://localhost:3000 and sign up. Add a Resend key, webhook secret, and verified sender in Settings. Existing accounts can add the five starter templates from the template library.

Sending requires the scheduled worker. Configure an external scheduler or use the included Vercel cron to call `GET /api/jobs` every minute with `Authorization: Bearer CRON_SECRET`. The Send button queues work durably; it does not launch an unreliable detached request.

## Share the local account online

The local account stores its database and attachments on disk, so deploy the app as one persistent Docker service with a mounted volume. Do not deploy this mode to Vercel/serverless functions or run more than one replica: they do not share the local database. The repository includes a Dockerfile configured for Railway.

1. Push this repository to GitHub, then in Railway create a project from `mohammedyazer755-svg/Email_Automater`, branch `main`. Railway detects the root `Dockerfile` and builds local mode into the app.
2. In the app service, create and attach a volume with mount path `/app/.local-data`. Keep one app replica.
3. In the service Variables tab add `LOCAL_LOGIN_EMAIL`, `LOCAL_LOGIN_PASSWORD` (use the same local credentials you plan to share), `LOCAL_SESSION_SECRET` (a new random value with at least 32 characters), `CRON_SECRET`, and `PROVIDER_KEY_ENCRYPTION_KEY` (64 hex characters). Set `NEXT_PUBLIC_APP_URL` to the public URL after Railway generates it. The Docker image sets `NEXT_PUBLIC_LOCAL_MODE=true` and `LOCAL_DATA_DIR=/app/.local-data`.
4. Generate a Railway domain in the service's Settings/Networking, wait for the deployment health check at `/api/health`, then send your friends the domain and shared login. Anyone with that account can read, edit, export, and delete all shared workspace data, and can configure or trigger sends.

Railway documents [Dockerfile builds](https://docs.railway.com/builds/dockerfiles) and [persistent volumes](https://docs.railway.com/volumes). A volume mount is necessary because app storage must survive deploys/restarts. Railway currently lists a free trial with $5 credits for 30 days, then $1/month and 0.5 GB volume; its Hobby plan has $5/month minimum usage. Check [current pricing](https://railway.com/pricing) before deploying. Real email sends still require a Resend API key and verified sender.

## Send from Gmail without a custom domain

The Gmail option sends through Google Apps Script over HTTPS, so it works on Railway trial/free plans and does not require Resend or a domain. In the deployed app, open **Settings ? Provider ? Gmail (Google Apps Script)**.

1. While signed into the Gmail account you want to send from, open [Google Apps Script](https://script.google.com/home) and click **New project**.
2. Replace the starter code in `Code.gs` with the contents of [`google-apps-script/Code.gs`](google-apps-script/Code.gs). Replace `REPLACE_WITH_YOUR_GMAIL_ADDRESS` with your Gmail address. Save.
3. At the top function picker, select `setupRelay` and click **Run**. Approve Google?s permission prompt. Open **Execution log** and copy the generated relay secret.
4. Select `authorizeGmail` and click **Run**. Approve its Gmail sending permission.
5. Click **Deploy ? New deployment ? Web app**. Set **Execute as: Me** and **Who has access: Anyone**, then click **Deploy**. Copy the URL ending in `/exec`.
6. In MailAutomator **Settings ? Provider**, choose **Gmail (Google Apps Script)**. Enter the same Gmail address, the `/exec` URL, and the relay secret from the execution log. Click **Save settings**.
7. Open **Settings ? Senders**, add that same Gmail address, and click **Check verification**. Then select it in your campaign.

The relay sends as the Gmail account that owns the script. Keep its URL and secret private. A consumer Google account currently has an Apps Script sending quota of 100 recipients per day; Google can change quotas. See [Google?s quota page](https://developers.google.com/apps-script/guides/services/quotas).

## Included

- Multi-sheet CSV/XLS/XLSX parsing in a Web Worker, confidence scores, strict validation, source tracking, deduplication, and recipient review.
- Paginated contacts, import history, groups, bulk actions, manual additions, and formula-safe CSV exports.
- TipTap editor, starter/custom templates, private attachments, preview, drafts, tests, schedules and confirmation before sending.
- Resend delivery with verified identities, encrypted user keys, atomic queue claims, stable idempotency keys, bounded retries and suppression.
- Delivery reports, live progress, historical charts, and SQL-aggregated analytics.
- Form-based workflows with email, wait, and condition steps; manual/import/scheduled enrollment; pause and recovery.
- Authenticated and ownership-checked APIs, server-side HTML sanitization, persistent rate limits, strict mutation origin checks, RLS and service-only mutations.

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/Radix UI, Supabase Auth/Postgres/Storage, SheetJS, TipTap, Resend, Recharts, Vitest, PGlite and Playwright. Node.js 22.12+ recommended.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests exercise parsing, malformed addresses, 10,000-row workbooks, sanitization, encryption and retry policy. PostgreSQL integration tests apply the actual migrations in PGlite and exercise import ? campaign ? queue ? delivery, tenant isolation, webhook ordering and workflow progression. Browser tests cover public navigation and auth/API boundaries. The authenticated import-to-draft browser test runs when `E2E_EMAIL` and `E2E_PASSWORD` are configured; tests do not send real emails.

## Project layout

- `app/(dashboard)`: workspace routes.
- `components/platform`: data-backed screens; `components/email` and `components/charts`: lazy-loaded editors and charts.
- `app/api`: authenticated resource, analytics, attachment, worker and webhook endpoints.
- `lib/spreadsheet`, `lib/email`, `lib/automation`: processing engines.
- `lib/server`: validation, authorization, encryption and resource handlers.
- `supabase/migrations`: transactional jobs, security and reporting additions to Phase 1.
- `tests`: unit, database integration and browser checks.

## Documentation

- [Deployment and operations](docs/DEPLOYMENT.md)
- [User guide](docs/USER_GUIDE.md)
- [API reference](docs/API.md)
- [Contributing](CONTRIBUTING.md)
- [Sample spreadsheet](docs/sample-contacts.csv)

Imports and campaigns support up to 10,000 recipients; files and total campaign attachments are capped at 10 MB. Worker throughput is bounded by a single global lease and configured provider rate. Each workflow enrolls a contact once; scheduled runs pick up newly eligible contacts. Billing is intentionally a future placeholder. Production delivery, domain verification, OAuth, and uptime monitoring must be checked in the deployed environment.

## Screenshots

Browser-tested screens below use local fixture data.

![Spreadsheet review](docs/screenshots/import-review.png)
![Campaign preview](docs/screenshots/campaign-preview.png)

See [implementation status](docs/IMPLEMENTATION_STATUS.md) for completed scope, operating limits, and the remaining production setup.
