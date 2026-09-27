import 'server-only';
import { admin, checked } from '@/lib/server/db';
import { providerFor } from './provider';
import { ProviderError, retryDelay } from './retryHandler';
import { RateLimiter } from './rateLimiter';
import { loadAttachments } from '@/lib/server/attachments';
import { HttpError } from '@/lib/server/http';
export async function processQueue(deadline = Date.now() + 45000) {
  const db = admin(),
    limiter = new RateLimiter(
      Math.max(1, Math.min(10, Number(process.env.PROVIDER_SEND_RATE) || 1)),
    );
  let processed = 0;
  while (Date.now() < deadline) {
    const rows = checked(await db.rpc('claim_email'));
    const item = rows?.[0];
    if (!item) break;
    const campaign = checked(
      await db.from('campaigns').select('*').eq('id', item.campaign_id).single(),
    );
    const contact = item.contact_id
      ? checked(await db.from('contacts').select('status').eq('id', item.contact_id).maybeSingle())
      : null;
    if (!contact || contact.status !== 'active') {
      checked(
        await db
          .from('email_queue')
          .update({ status: 'skipped', error_message: 'Contact removed or suppressed' })
          .eq('id', item.id)
          .eq('lease_token', item.lease_token),
      );
      checked(await db.rpc('refresh_campaign', { p_id: campaign.id }));
      continue;
    }
    try {
      const settings = checked(
        await db
          .from('user_settings')
          .select('send_rate,next_send_at')
          .eq('user_id', campaign.user_id)
          .maybeSingle(),
      );
      const delay = Math.max(0, new Date(settings?.next_send_at || 0).getTime() - Date.now());
      if (delay) await new Promise((r) => setTimeout(r, Math.min(delay, 1000)));
      await limiter.wait();
      const sender = checked(
        await db
          .from('sender_identities')
          .select('*')
          .eq('id', campaign.sender_id)
          .eq('user_id', campaign.user_id)
          .eq('verified', true)
          .single(),
      );
      const attachments = await loadAttachments(campaign.user_id, campaign.attachments || []);
      const provider = await providerFor(campaign.user_id);
      const result = await provider.sendEmail(
        {
          from: `${campaign.from_name.replace(/[<>\r\n"]/g, '')} <${sender.from_email}>`,
          to: item.recipient_email,
          subject: campaign.subject,
          html: campaign.body_html,
          text: campaign.body_text || undefined,
          replyTo: campaign.reply_to || undefined,
          attachments,
        },
        `queue-${item.id}`,
      );
      // Persist acceptance before any ancillary work; recovery uses the same provider idempotency key.
      checked(
        await db
          .from('email_queue')
          .update({
            status: 'sent',
            provider_message_id: result.messageId,
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', item.id)
          .eq('status', 'sending')
          .eq('lease_token', item.lease_token),
      );
      checked(
        await db.from('user_settings').upsert({
          user_id: campaign.user_id,
          next_send_at: new Date(Date.now() + 1000 / (settings?.send_rate || 1)).toISOString(),
        }),
      );
    } catch (error) {
      const delay = retryDelay(
        item.retry_count,
        error instanceof ProviderError || error instanceof HttpError ? error.status : 500,
      );
      checked(
        await db
          .from('email_queue')
          .update({
            status: delay === null ? 'failed' : 'queued',
            retry_count: item.retry_count + 1,
            next_attempt_at: new Date(Date.now() + (delay || 0)).toISOString(),
            error_message: error instanceof Error ? error.message.slice(0, 500) : 'Delivery failed',
          })
          .eq('id', item.id)
          .eq('status', 'sending')
          .eq('lease_token', item.lease_token),
      );
    }
    checked(await db.rpc('refresh_campaign', { p_id: campaign.id }));
    processed++;
  }
  return processed;
}
