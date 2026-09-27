import { handle, session, HttpError } from '@/lib/server/http';
import { checked } from '@/lib/server/db';
export async function GET(req: Request, ctx: { params: Promise<{ metric: string }> }) {
  return handle(async () => {
    const { user, db } = await session(req);
    const { metric } = await ctx.params;
    if (!['overview', 'timeline', 'campaigns'].includes(metric))
      throw new HttpError(404, 'Not found.');
    const days = Number(new URL(req.url).searchParams.get('days') || 0);
    if (![0, 7, 30, 90].includes(days)) throw new HttpError(400, 'Invalid date range.');
    const report = checked(
      await db.rpc('analytics_report', {
        p_user: user.id,
        p_since: days ? new Date(Date.now() - days * 86400000).toISOString() : null,
      }),
    );
    return metric === 'overview' ? report : metric === 'timeline' ? report.timeline : report.top;
  });
}
