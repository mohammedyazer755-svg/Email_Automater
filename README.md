# MailAutomator — Smart Email Automation Platform

A modern web-based application for turning messy, unorganized spreadsheets (Google Forms exports, CSV, XLS, XLSX) into clean contact lists, composing personalized email campaigns, and securely delivering individual messages through a persistent queue.

---

## Key Features

- **Intelligent Spreadsheet Parsing**: Content-based email detection across all sheets, columns, and rows without requiring rigid column names.
- **Automated Cleaning & Deduplication**: Normalizes email addresses, skips blank and null cells, filters malformed entries, and removes duplicate addresses while tracking the original source location.
- **Confidence Scoring & Diagnostics**: Calculates email density per column and presents a comprehensive import summary report.
- **Rich-Text Composer & Reusable Templates**: Built with TipTap for formatted text, links, headings, bullet lists, and starter templates for event confirmations, reminders, announcements, and certificates.
- **Individual Privacy-Preserving Delivery**: Sends messages individually to each recipient rather than exposing entire mailing lists via bulk CC or BCC.
- **Controlled Rate Sending Queue**: Prevents rate limit throttling and mailbox provider rejections with exponential backoff and retry policies.
- **Delivery Analytics & Webhooks**: Live tracking of Queued, Sending, Delivered, Failed, and Bounced states.
- **Multi-Step Workflows**: Automated email sequences with configurable delays and condition checks.
- **Multiple Provider Support**: Supports Resend API and Gmail via Google Apps Script relay.
- **Two Operating Modes**: Cloud mode with Supabase and single-user persistent Local Mode.

---

## Getting Started

### Prerequisites
- Node.js 20+ (Node.js 22 LTS recommended)
- npm or pnpm

### Installation

```sh
git clone https://github.com/mohammedyazer755-svg/Email_Automater.git
cd Email_Automater/mail-automator
npm install
```

---

## Operating Modes

### Option 1: Personal Local Mode (No Supabase Required)

Local mode saves contacts, templates, imports, campaigns, and delivery logs in a `.local-data/` directory on your machine.

1. Create or update `.env.local`:
   ```env
   NEXT_PUBLIC_LOCAL_MODE=true
   LOCAL_LOGIN_EMAIL=admin@example.com
   LOCAL_LOGIN_PASSWORD=your-secure-password
   LOCAL_SESSION_SECRET=a-random-secret-at-least-32-chars-long
   PROVIDER_KEY_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
   CRON_SECRET=your-cron-secret
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
2. Start the development server:
   ```sh
   npm run dev
   ```
3. Open [http://localhost:3000/login](http://localhost:3000/login) and log in with your local credentials.

---

### Option 2: Cloud Mode (Supabase + PostgreSQL)

1. Copy `.env.example` to `.env.local` and fill in your Supabase project keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   PROVIDER_KEY_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
   CRON_SECRET=your-cron-secret
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
2. Apply the database migrations:
   - Run `supabase/schema.sql` once on your Supabase SQL editor.
   - Run all migration files in `supabase/migrations/` in sequential order.
3. Start the application:
   ```sh
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) and sign up.

---

## Email Delivery Setup

### Option A: Send via Gmail (Google Apps Script Relay — No Custom Domain Needed)

This relay allows sending directly through your Gmail account over HTTPS:

1. Open [Google Apps Script](https://script.google.com/home) while signed into the desired Gmail account and create a **New project**.
2. Replace `Code.gs` with the contents of [`google-apps-script/Code.gs`](google-apps-script/Code.gs) and replace `REPLACE_WITH_YOUR_GMAIL_ADDRESS` with your email.
3. In the function selector, select `setupRelay` and click **Run**. Grant permissions and copy the generated secret from the **Execution log**.
4. Select `authorizeGmail` and click **Run** to authorize sending.
5. Click **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**, then deploy and copy the URL ending in `/exec`.
6. In MailAutomator **Settings → Provider**, select **Gmail (Google Apps Script)** and enter your Gmail address, `/exec` URL, and relay secret.
7. Under **Settings → Senders**, add the same Gmail address and click **Check verification**.

---

### Option B: Send via Resend (Custom Domain)

1. In MailAutomator **Settings → Provider**, select **Resend** and input your API key (`re_...`).
2. Under **Settings → Senders**, add your verified domain sender identity (with SPF, DKIM, and DMARC records).

---

## Deployment on Railway

The repository includes a production-ready `Dockerfile` for single-service container deployment:

1. Create a new Railway project connected to your GitHub repository.
2. In the app service, add a persistent volume mounted at `/app/.local-data`.
3. Set environment variables:
   - `NEXT_PUBLIC_LOCAL_MODE=true`
   - `LOCAL_DATA_DIR=/app/.local-data`
   - `LOCAL_LOGIN_EMAIL=your-email@domain.com`
   - `LOCAL_LOGIN_PASSWORD=your-secure-password`
   - `LOCAL_SESSION_SECRET=your-32-char-random-secret`
   - `PROVIDER_KEY_ENCRYPTION_KEY=64-hex-characters`
   - `CRON_SECRET=your-cron-secret`
   - `NEXT_PUBLIC_APP_URL=https://your-app.up.railway.app`
4. Generate a public Railway domain in **Networking** settings.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI & Styling**: React 19, Tailwind CSS 4, shadcn/Radix UI, Lucide Icons
- **Spreadsheet Parsing**: SheetJS (`xlsx`) in a Web Worker
- **Rich-Text Editor**: TipTap
- **Database & Auth**: PostgreSQL (Supabase / PGlite / Disk JSON store)
- **Charts & Insights**: Recharts
- **Testing**: Vitest, Playwright E2E

---

## Test & Build Checks

```sh
# Run unit & database integration tests
npm test

# Run TypeScript checks
npm run typecheck

# Run linter
npm run lint

# Build for production
npm run build
```

---

## Project Structure

```
mail-automator/
├── app/                  # Next.js App Router (pages & API endpoints)
│   ├── (auth)/           # Login, signup, and authentication flows
│   ├── (dashboard)/      # Protected workspace views (imports, campaigns, contacts, etc.)
│   └── api/              # REST & webhook API endpoints
├── components/           # UI primitives & platform screen components
│   ├── platform/         # Data screens (imports, campaigns, contacts, composer, settings)
│   ├── ui/               # Radix & shadcn components
│   └── email/            # TipTap rich email editor
├── lib/                  # Business logic & engines
│   ├── spreadsheet/      # SheetJS parser, detector, validator, deduplicator, worker
│   ├── email/            # Delivery engine, rate limiter, Resend & Gmail providers
│   ├── automation/       # Multi-step workflow state machine
│   └── server/           # Encryption, local storage, API security helpers
├── supabase/             # Database schemas and migrations
└── tests/                # Unit, integration, and Playwright test suites
```

---

## License

MIT License. Designed and built for organizers, clubs, and teams who value clean communication.
