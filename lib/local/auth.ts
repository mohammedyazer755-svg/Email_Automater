import 'server-only';
import { createHmac, timingSafeEqual, scryptSync } from 'node:crypto';
import { localUserId } from './config';
export const cookieName = 'mailautomator_local';
const secret = () => {
  const key = process.env.LOCAL_SESSION_SECRET;
  if (!key || key.length < 32)
    throw new Error('Set LOCAL_SESSION_SECRET to at least 32 characters.');
  return key;
};
export function localUser() {
  return {
    id: localUserId,
    email: process.env.LOCAL_LOGIN_EMAIL || 'admin@local.test',
    user_metadata: { full_name: 'Owner', avatar_url: '' },
  };
}
export function validCredentials(email: string, password: string) {
  const configured = process.env.LOCAL_LOGIN_PASSWORD;
  if (!configured) return false;
  return (
    email.toLowerCase() === localUser().email.toLowerCase() &&
    timingSafeEqual(scryptSync(password, secret(), 32), scryptSync(configured, secret(), 32))
  );
}
export function issueSession() {
  const value = `${localUserId}.${Date.now() + 7 * 86400000}`;
  return `${value}.${createHmac('sha256', secret()).update(value).digest('hex')}`;
}
export function verifySession(token?: string) {
  if (!token) return false;
  const [id, expiry, signature, extra] = token.split('.');
  if (
    extra ||
    id !== localUserId ||
    !/^\d+$/.test(expiry || '') ||
    Number(expiry) <= Date.now() ||
    !/^[a-f0-9]{64}$/.test(signature || '')
  )
    return false;
  const expected = createHmac('sha256', secret()).update(`${id}.${expiry}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
