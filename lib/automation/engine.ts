import 'server-only';
import { CronExpressionParser } from 'cron-parser';
import { admin, checked } from '@/lib/server/db';
export async function processAutomations() {
  const db = admin(),
    now = new Date().toISOString();
  const scheduled = checked(
    await db
      .from('automations')
      .select('*')
      .eq('status', 'active')
      .eq('trigger_type', 'scheduled')
      .lte('next_run_at', now)
      .limit(100),
  );
  for (const a of scheduled || []) {
    try {
      const next = CronExpressionParser.parse(a.trigger_config.schedule_cron, {
        tz: a.trigger_config.timezone,
      })
        .next()
        .toISOString();
      checked(await db.rpc('enroll_scheduled', { p_id: a.id, p_next: next }));
    } catch (error) {
      console.error(
        'Scheduled automation failed',
        a.id,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
  const due = checked(
    await db
      .from('automation_enrollments')
      .select('id,automations!inner(status)')
      .eq('status', 'active')
      .eq('automations.status', 'active')
      .lte('next_action_at', now)
      .order('next_action_at')
      .limit(100),
  );
  for (const e of due || []) {
    const result = await db.rpc('advance_automation', { p_id: e.id });
    if (result.error)
      checked(
        await db
          .from('automation_enrollments')
          .update({
            error_message: result.error.message,
            next_action_at: new Date(Date.now() + 300000).toISOString(),
          })
          .eq('id', e.id),
      );
  }
  return due?.length || 0;
}
