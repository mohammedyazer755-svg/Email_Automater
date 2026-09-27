# Contributing

Use Node.js 22.12+ and `npm ci`. Copy `.env.example` to `.env.local` and configure a disposable Supabase project. Follow `AGENTS.md` and the installed Next.js documentation before changing routing or framework APIs.

Keep changes focused and add meaningful tests for parsing, ownership boundaries, queue state, and workflow transitions. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Browser checks use `npm run test:e2e`; authenticated checks require a dedicated test account. Never run email delivery tests against real contact lists.

Add numbered SQL migrations rather than rewriting a previously applied schema. Every new table must enable RLS; secrets must have no browser privileges. Privileged functions must revoke PUBLIC/anon/authenticated execution. Use ownership checks before any service-role operation. Queue changes must preserve idempotency, suppression, and recovery behavior.

Do not commit `.env.local`, API keys, cookies, database exports, recipient data, or authentication test state. Include migration and deployment notes with your pull request. Format code with `npm run format`.
