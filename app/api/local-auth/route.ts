import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { localMode } from '@/lib/local/config';
import {
  cookieName,
  issueSession,
  localUser,
  validCredentials,
  verifySession,
} from '@/lib/local/auth';
import { database } from '@/lib/local/database';
import { isAllowedOrigin } from '@/lib/local/origin';
import { body, handle, HttpError } from '@/lib/server/http';
import { z } from 'zod';
export const runtime = 'nodejs';
function enabled(req: Request, mutation = false) {
  if (!localMode) throw new HttpError(404, 'Not found');
  if (mutation && !isAllowedOrigin(req)) throw new HttpError(403, 'Request origin is not allowed.');
}
export function GET(req: Request) {
  return handle(async () => {
    enabled(req);
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
    return { user };
  });
}
const state = globalThis as typeof globalThis & {
  localLoginAttempts?: { count: number; reset: number };
};
export function POST(req: Request) {
  return handle(async () => {
    enabled(req, true);
    const input = z
      .object({ email: z.string().max(254), password: z.string().max(256) })
      .parse(await body(req));
    if (!state.localLoginAttempts || state.localLoginAttempts.reset < Date.now())
      state.localLoginAttempts = { count: 0, reset: Date.now() + 60000 };
    if (++state.localLoginAttempts.count > 10)
      throw new HttpError(429, 'Too many attempts. Wait one minute.');
    if (!validCredentials(input.email, input.password))
      throw new HttpError(401, 'Incorrect email or password.');
    await database();
    state.localLoginAttempts.count = 0;
    const response = NextResponse.json(
      { user: localUser() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    response.cookies.set(cookieName, issueSession(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(req.url).protocol === 'https:',
      path: '/',
      maxAge: 7 * 86400,
    });
    return response;
  });
}
export function DELETE(req: Request) {
  return handle(async () => {
    enabled(req, true);
    const response = NextResponse.json({ user: null });
    response.cookies.set(cookieName, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  });
}
