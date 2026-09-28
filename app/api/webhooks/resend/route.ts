import { localMode } from '@/lib/local/config';
import { Resend } from 'resend';
import { z } from 'zod';
import { admin, checked } from '@/lib/server/db';
import { handle, HttpError } from '@/lib/server/http';
import { decrypt } from '@/lib/server/security';
export async function POST(req: Request) {
  return handle(async () => {
    if (
      !localMode &&
      (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL)
    )
      throw new HttpError(503, 'Webhook storage is not configured.');
    const db = admin();
    const user = new URL(req.url).searchParams.get('user');
    let secret = process.env.RESEND_WEBHOOK_SECRET;
    if (user) {
      z.string().uuid().parse(user);
      const row = checked(
        await db
          .from('user_settings')
          .select('webhook_secret_encrypted')
          .eq('user_id', user)
          .maybeSingle(),
      );
      secret = row?.webhook_secret_encrypted ? decrypt(row.webhook_secret_encrypted) : undefined;
    }
    if (!secret) throw new HttpError(503, 'Webhook is not configured.');
    const payload = await req.text();
    if (payload.length > 1000000) throw new HttpError(413, 'Payload too large.');
    const eventId = req.headers.get('svix-id') || '';
    let event;
    try {
      event = new Resend('webhook-verification-only').webhooks.verify({
        payload,
        headers: {
          id: eventId,
          timestamp: req.headers.get('svix-timestamp') || '',
          signature: req.headers.get('svix-signature') || '',
        },
        webhookSecret: secret,
      });
    } catch {
      throw new HttpError(400, 'Invalid webhook signature.');
    }
    if (!('email_id' in event.data)) return { ok: true };
    // Scope BYOK events to the owner; unknown messages are retained for acceptance/webhook races.
    const message = event.data.email_id;
    const owner = user || process.env.SERVER_SENDER_USER_ID;
    if (!owner) throw new HttpError(503, 'Webhook owner is not configured.');
    checked(
      await db.from('delivery_logs').upsert(
        {
          event_id: eventId,
          provider_message_id: message,
          event_type: event.type,
          payload: event,
          owner_id: owner,
        },
        { onConflict: 'event_id', ignoreDuplicates: true },
      ),
    );
    checked(await db.rpc('apply_delivery_event', { p_event: eventId }));
    return { ok: true };
  });
}
