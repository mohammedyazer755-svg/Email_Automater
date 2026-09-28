import { cookies } from 'next/headers';
import { localMode } from '@/lib/local/config';
import { cookieName, verifySession, localUser } from '@/lib/local/auth';
import { database } from '@/lib/local/database';
import { isAllowedOrigin } from '@/lib/local/origin';
import { createClient } from '@/lib/supabase/server';
import { admin, checked } from './db';
import { ZodError } from 'zod';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function session(req: Request) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    if (!isAllowedOrigin(req)) throw new HttpError(403, 'Request origin is not allowed.');
  }
  if (localMode) {
    if (!verifySession((await cookies()).get(cookieName)?.value))
      throw new HttpError(401, 'Sign in to continue.');
    const user = localUser();
    const profile = await (
      await database()
    ).query<{ metadata: typeof user.user_metadata }>(
      'select metadata from local_profile where id=$1',
      [user.id],
    );
    if (profile.rows[0])
      user.user_metadata = { ...user.user_metadata, ...profile.rows[0].metadata };
    return { user, db: admin() };
  }
  const auth = await createClient();
  const {
    data: { user },
    error,
  } = await auth.auth.getUser();
  if (error || !user) throw new HttpError(401, 'Sign in to continue.');
  return { user, db: admin() };
}
export async function body(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, 'A JSON body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 12 * 1024 * 1024) {
      await reader.cancel();
      throw new HttpError(413, 'Request is too large.');
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('Expected object');
    return parsed;
  } catch {
    throw new HttpError(400, 'Invalid JSON.');
  }
}
export async function handle(fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    return result instanceof Response
      ? result
      : Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof ZodError)
      return Response.json(
        { error: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
        { status: 400 },
      );
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    console.error('API error', e instanceof Error ? e.message : 'Unknown error');
    return Response.json(
      { error: 'The operation could not be completed. Check configuration and try again.' },
      { status: 500 },
    );
  }
}
export async function limit(user: string, bucket: string, max = 1000) {
  if (!checked(await admin().rpc('take_api_limit', { p_user: user, p_bucket: bucket, p_max: max })))
    throw new HttpError(429, 'Hourly limit reached. Try again later.');
}
export function page(req: Request) {
  const q = new URL(req.url).searchParams;
  const requestedSize = Number(q.get('size') || 25),
    index = Number(q.get('page') || 1);
  if (
    !Number.isSafeInteger(requestedSize) ||
    requestedSize < 1 ||
    !Number.isSafeInteger(index) ||
    index < 1 ||
    index > 1000000
  )
    throw new HttpError(400, 'Invalid pagination.');
  const size = Math.min(100, requestedSize);
  return { q, size, start: (index - 1) * size };
}
