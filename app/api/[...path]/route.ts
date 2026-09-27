import { handle } from '@/lib/server/http';
import { resources } from '@/lib/server/resources';
export const runtime = 'nodejs';
type Context = { params: Promise<{ path: string[] }> };
async function route(req: Request, ctx: Context) {
  return handle(async () => resources(req, (await ctx.params).path));
}
export { route as GET, route as POST, route as PATCH, route as DELETE };
