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
export class GmailRelayProvider implements EmailProvider {
  constructor(
    private email: string,
    private endpoint: string,
    private token: string,
  ) {}
  private async request(payload: Record<string, unknown>) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: this.token, ...payload }),
      signal: AbortSignal.timeout(30000),
      redirect: 'follow',
    });
    let result: { error?: string; email?: string; messageId?: string };
    try {
      result = await response.json();
    } catch {
      throw new HttpError(502, 'Gmail relay returned an invalid response. Check its Web App URL.');
    }
    if (!response.ok || result.error)
      throw new HttpError(400, result.error || 'Gmail could not send this message.');
    return result;
  }
  async verify() {
    const result = await this.request({ action: 'verify' });
    if (result.email?.toLowerCase() !== this.email.toLowerCase())
      throw new HttpError(
        400,
        'The Gmail address in the relay does not match the configured sender.',
      );
  }
  async sendEmail(params: EmailParams, key: string) {
    const match = /^\s*(.*?)\s*<([^<>]+)>\s*$/.exec(params.from);
    const fromEmail = match?.[2] || this.email;
    if (fromEmail.toLowerCase() !== this.email.toLowerCase())
      throw new HttpError(400, `Use ${this.email} as the Gmail sender address.`);
    const result = await this.request({
      action: 'send',
      idempotencyKey: key,
      email: fromEmail,
      name: match?.[1]?.replace(/^"|"$/g, '') || this.email,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text || '',
      replyTo: params.replyTo || '',
      attachments: (params.attachments || []).map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
      })),
    });
    return { messageId: result.messageId || crypto.randomUUID() };
  }
  senderEmail() {
    return this.email;
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
  if (!key) throw new HttpError(400, 'Connect Gmail or configure a Resend API key in Settings.');
  if (key.startsWith('gmail-script:')) {
    const [email, endpoint, token] = key.slice(13).split('\n');
    if (!email || !endpoint || !token)
      throw new HttpError(400, 'Gmail relay settings are incomplete.');
    try {
      if (new URL(endpoint).protocol !== 'https:') throw new Error();
    } catch {
      throw new HttpError(400, 'Gmail relay URL must be an HTTPS Apps Script Web App URL.');
    }
    return new GmailRelayProvider(email, endpoint, token);
  }
  return new ResendProvider(new TimedResend(key));
}
export async function verifySender(user: string, id: string) {
  const db = admin();
  const sender = checked(
    await db.from('sender_identities').select('*').eq('id', id).eq('user_id', user).single(),
  );
  const provider = await providerFor(user);
  if (provider instanceof GmailRelayProvider) {
    if (sender.from_email.toLowerCase() !== provider.senderEmail().toLowerCase())
      throw new HttpError(400, `For Gmail, the sender address must be ${provider.senderEmail()}.`);
    checked(await db.from('sender_identities').update({ verified: true }).eq('id', id));
    return { ...sender, verified: true };
  }
  if (!(provider instanceof ResendProvider))
    throw new HttpError(400, 'Unsupported email provider.');
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
