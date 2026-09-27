import { timingSafeEqual } from 'node:crypto';
import { admin, checked } from '@/lib/server/db';
import { handle, HttpError } from '@/lib/server/http';
import { processQueue } from '@/lib/email/queue';
import { processAutomations } from '@/lib/automation/engine';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(req: Request) {
  return handle(async () => {
    const expected = process.env.CRON_SECRET;
    const actual = req.headers.get('authorization') || '';
    const expectedBytes = Buffer.from(`Bearer ${expected || ''}`),
      actualBytes = Buffer.from(actual);
    if (
      !expected ||
      actualBytes.length !== expectedBytes.length ||
      !timingSafeEqual(actualBytes, expectedBytes)
    )
      throw new HttpError(401, 'Unauthorized.');
    const db = admin(),
      token = crypto.randomUUID(),
      deadline = Date.now() + 45000;
    if (!checked(await db.rpc('acquire_worker', { p_token: token }))) return { busy: true };
    try {
      const scheduled = checked(
        await db
          .from('campaigns')
          .select('id,user_id')
          .eq('status', 'scheduled')
          .lte('scheduled_at', new Date().toISOString())
          .limit(100),
      );
      for (const campaign of scheduled || []) {
        const result = await db.rpc('enqueue_campaign', {
          p_user: campaign.user_id,
          p_id: campaign.id,
        });
        if (result.error) {
          console.error('Scheduled campaign failed', campaign.id, result.error.message);
          checked(
            await db
              .from('campaigns')
              .update({ status: 'failed' })
              .eq('id', campaign.id)
              .eq('status', 'scheduled'),
          );
        }
      }
      const automations = await processAutomations();
      const processed = await processQueue(deadline);
      checked(await db.rpc('reconcile_delivery_events'));
      return { processed, automations };
    } finally {
      checked(
        await db
          .from('worker_locks')
          .update({ expires_at: null, token: null })
          .eq('name', 'delivery')
          .eq('token', token),
      );
    }
  });
}
