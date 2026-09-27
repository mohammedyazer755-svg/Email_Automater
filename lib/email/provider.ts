import 'server-only';
import { Resend } from 'resend';
import { admin, checked } from '@/lib/server/db';
import { decrypt } from '@/lib/server/security';
import { HttpError } from '@/lib/server/http';
import { ProviderError } from './retryHandler';
export interface EmailParams {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
}
export interface EmailProvider {
  sendEmail(params: EmailParams, key: string): Promise<{ messageId: string }>;
}
class TimedResend extends Resend {
  override fetchRequest<T>(path: string, options: RequestInit = {}) {
    return super.fetchRequest<T>(path, { ...options, signal: AbortSignal.timeout(15000) });
  }
}
export class ResendProvider implements EmailProvider {
  constructor(public client: Resend) {}
  async sendEmail(params: EmailParams, key: string) {
    const result = await this.client.emails.send(
      { ...params, replyTo: params.replyTo },
      { idempotencyKey: key },
    );
    if (result.error) throw new ProviderError(result.error.message, result.error.statusCode || 500);
    return { messageId: result.data.id };
  }
}
export async function providerFor(user: string) {
  const settings = checked(
    await admin()
      .from('user_settings')
      .select('provider_key_encrypted')
      .eq('user_id', user)
      .maybeSingle(),
  );
  const key = settings?.provider_key_encrypted
    ? decrypt(settings.provider_key_encrypted)
    : process.env.SERVER_SENDER_USER_ID === user
      ? process.env.RESEND_API_KEY
      : undefined;
  if (!key) throw new HttpError(400, 'Configure your Resend API key in Settings.');
  return new ResendProvider(new TimedResend(key));
}
export async function verifySender(user: string, id: string) {
  const db = admin();
  const sender = checked(
    await db.from('sender_identities').select('*').eq('id', id).eq('user_id', user).single(),
  );
  const provider = await providerFor(user);
  const domain = sender.from_email.split('@')[1].toLowerCase();
  let after: string | undefined;
  let verified = false;
  for (let page = 0; page < 100; page++) {
    const result = await provider.client.domains.list({ limit: 100, ...(after ? { after } : {}) });
    if (result.error)
      throw new HttpError(
        400,
        'Unable to check domains. Use a Resend API key with domain read access.',
      );
    const match = result.data.data.find((d) => d.name.toLowerCase() === domain);
    if (match) {
      verified = match.status === 'verified';
      break;
    }
    if (!result.data.has_more) break;
    after = result.data.data.at(-1)?.id;
  }
  checked(await db.from('sender_identities').update({ verified }).eq('id', id));
  if (!verified)
    throw new HttpError(400, 'Verify this exact sending domain in Resend, then check again.');
  return { ...sender, verified };
}
