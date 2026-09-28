import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: { baseURL: process.env.E2E_BASE_URL || 'http://localhost:3100', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'node tests/e2e/auth-server.mjs',
          url: 'http://127.0.0.1:54329/health',
          timeout: 10000,
        },
        {
          command: 'npm run dev -- --port 3100',
          url: 'http://localhost:3100',
          timeout: 120000,
          env: {
            NEXT_DIST_DIR: '.next-e2e',
            NEXT_PUBLIC_LOCAL_MODE: 'false',
            NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
            NEXT_PUBLIC_APP_URL: 'http://localhost:3100',
          },
        },
      ],
});
