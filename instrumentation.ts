export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PUBLIC_LOCAL_MODE === 'true' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const state = globalThis as typeof globalThis & {
      localWorkerTimer?: ReturnType<typeof setInterval>;
    };
    if (state.localWorkerTimer) return;
    let running = false;
    state.localWorkerTimer = setInterval(async () => {
      if (running) return;
      running = true;
      try {
        const { GET } = await import('./app/api/jobs/route');
        const response = await GET(
          new Request(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/jobs`, {
            headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
          }),
        );
        if (!response.ok) console.error('Local delivery worker:', response.status);
      } catch (e) {
        console.error('Local delivery worker:', e instanceof Error ? e.message : 'Unable to run');
      } finally {
        running = false;
      }
    }, 15000);
    state.localWorkerTimer.unref();
  }
}
