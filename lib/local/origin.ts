/** Check browser mutations against the externally visible request origin.
 * Platforms such as Railway terminate HTTPS before forwarding requests to Next.js.
 */
export function isAllowedOrigin(req: Request) {
  const supplied = req.headers.get('origin');
  if (!supplied) return false;
  let origin: string;
  try {
    origin = new URL(supplied).origin;
  } catch {
    return false;
  }

  const allowed = new Set<string>();
  try {
    allowed.add(new URL(req.url).origin);
  } catch {
    /* invalid request URL */
  }
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.headers.get('host');
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProto || (req.url.startsWith('https:') ? 'https' : 'http');
  if (host && (protocol === 'https' || protocol === 'http')) allowed.add(`${protocol}://${host}`);

  // Runtime values are honored too, while not depending on NEXT_PUBLIC build-time substitution.
  try {
    if (process.env.NEXT_PUBLIC_APP_URL)
      allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
  } catch {
    /* ignore malformed optional configuration */
  }
  return allowed.has(origin);
}
