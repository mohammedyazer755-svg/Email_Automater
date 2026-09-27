import { z } from 'zod';
import { CronExpressionParser } from 'cron-parser';
import { admin, checked } from './db';
import { HttpError, body, page, session, limit } from './http';
import { cleanHtml, csvCell, encrypt } from './security';
import {
  automationInput,
  campaignInput,
  contactInput,
  email,
  ids,
  status,
  templateInput,
  uuid,
} from './schemas';
import { starterTemplates } from '@/lib/templates';
import { isValidEmail } from '@/lib/spreadsheet/validator';
import { providerFor, verifySender } from '@/lib/email/provider';
import { loadAttachments } from './attachments';

export async function owned(table: string, id: string, user: string) {
  uuid.parse(id);
  const row = checked(
    await admin().from(table).select('*').eq('id', id).eq('user_id', user).maybeSingle(),
  );
  if (!row) throw new HttpError(404, 'Record not found.');
  return row;
}
async function ownedContacts(user: string, contactIds: string[]) {
  if (!contactIds.length) return;
  for (let i = 0; i < contactIds.length; i += 500) {
    const chunk = contactIds.slice(i, i + 500);
    const rows = checked(
      await admin().from('contacts').select('id').eq('user_id', user).in('id', chunk),
    );
    if ((rows || []).length !== new Set(chunk).size) throw new HttpError(400, 'Invalid contacts.');
  }
}
export async function resources(req: Request, path: string[]) {
  const { user, db } = await session(req);
  const [resource, id, action, subId] = path;
  const method = req.method,
    { q, size, start } = page(req);
  if (method !== 'GET') await limit(user.id, 'mutations');
  const data = method === 'GET' ? null : await body(req);
  if (resource === 'contacts') {
    if (id === 'groups') {
      if (method === 'GET')
        return {
          items: checked(
            await db
              .from('contact_groups')
              .select('*')
              .eq('user_id', user.id)
              .order('name')
              .limit(100),
          ),
        };
      if (!action && method === 'POST') {
        const input = z
          .object({
            name: z.string().trim().min(1).max(100),
            color: z
              .string()
              .regex(/^#[a-f0-9]{6}$/i)
              .default('#4F46E5'),
          })
          .parse(data);
        return checked(
          await db
            .from('contact_groups')
            .insert({ ...input, user_id: user.id })
            .select()
            .single(),
        );
      }
      await owned('contact_groups', action, user.id);
      if (subId === 'members' && method === 'POST') {
        const selected = ids.parse(data.ids);
        await ownedContacts(user.id, selected);
        checked(
          await db.from('contact_group_members').upsert(
            selected.map((contact_id) => ({ contact_id, group_id: action })),
            { onConflict: 'group_id,contact_id' },
          ),
        );
        return { ok: true };
      }
      if (method === 'DELETE') {
        checked(await db.from('contact_groups').delete().eq('id', action));
        return { ok: true };
      }
    }
    if (id === 'export' && method === 'POST') {
      const selected = ids.parse(data.ids);
      await ownedContacts(user.id, selected);
      const rows = [];
      for (let i = 0; i < selected.length; i += 500)
        rows.push(
          ...(checked(
            await db
              .from('contacts')
              .select('email,name,status,created_at')
              .eq('user_id', user.id)
              .in('id', selected.slice(i, i + 500)),
          ) || []),
        );
      return new Response(
        [
          'Email,Name,Status,Created',
          ...rows.map((r) => [r.email, r.name, r.status, r.created_at].map(csvCell).join(',')),
        ].join('\r\n'),
        {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="contacts.csv"',
          },
        },
      );
    }
    if (!id && method === 'GET') {
      let query = db
        .from('contacts')
        .select(
          '*, imports(filename), contact_group_members(group_id,contact_groups(name,color))',
          { count: 'exact' },
        )
        .eq('user_id', user.id);
      if (q.get('search'))
        query = query.ilike('email', `%${q.get('search')!.replace(/[%_\\]/g, '')}%`);
      if (q.get('status')) query = query.eq('status', status.parse(q.get('status')));
      if (q.get('group')) {
        await owned('contact_groups', q.get('group')!, user.id);
        // Use the membership relation as an inner filter, avoiding Supabase's default 1000-row cap.
        query = db
          .from('contacts')
          .select(
            '*, imports(filename), contact_group_members!inner(group_id,contact_groups(name,color))',
            { count: 'exact' },
          )
          .eq('user_id', user.id)
          .eq('contact_group_members.group_id', q.get('group')!);
        if (q.get('search'))
          query = query.ilike('email', `%${q.get('search')!.replace(/[%_\\]/g, '')}%`);
        if (q.get('status')) query = query.eq('status', status.parse(q.get('status')));
      }
      if (q.get('import')) {
        await owned('imports', q.get('import')!, user.id);
        query = db
          .from('contacts')
          .select('*,import_contacts!inner(import_id)', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('import_contacts.import_id', q.get('import')!);
        if (q.get('status')) query = query.eq('status', status.parse(q.get('status')));
      }
      const result = await query
        .order(q.get('sort') === 'email' ? 'email' : 'created_at', {
          ascending: q.get('sort') === 'email' || q.get('sort') === 'oldest',
        })
        .range(start, start + size - 1);
      return { items: checked(result), count: result.count };
    }
    if (!id && method === 'POST') {
      const input = contactInput.parse(data);
      if (input.group_id) await owned('contact_groups', input.group_id, user.id);
      const existing = checked(
        await db
          .from('contacts')
          .select('id')
          .eq('user_id', user.id)
          .eq('email', input.email)
          .maybeSingle(),
      );
      if (existing) throw new HttpError(409, 'This email is already a contact.');
      const row = checked(
        await db
          .from('contacts')
          .insert({ user_id: user.id, email: input.email, name: input.name })
          .select()
          .single(),
      );
      if (input.group_id)
        checked(
          await db
            .from('contact_group_members')
            .insert({ group_id: input.group_id, contact_id: row.id }),
        );
      return row;
    }
    if (!id && (method === 'DELETE' || method === 'PATCH')) {
      const selected = ids.parse(data.ids);
      await ownedContacts(user.id, selected);
      if (method === 'DELETE')
        checked(await db.from('contacts').delete().eq('user_id', user.id).in('id', selected));
      else
        checked(
          await db
            .from('contacts')
            .update({ status: status.parse(data.status) })
            .eq('user_id', user.id)
            .in('id', selected),
        );
      return { ok: true };
    }
    if (id) {
      const row = await owned('contacts', id, user.id);
      if (method === 'GET') {
        const [imports, deliveries] = await Promise.all([
          db
            .from('import_contacts')
            .select('*, imports(id,filename,created_at)')
            .eq('contact_id', id)
            .range(start, start + size - 1),
          db
            .from('email_queue')
            .select('*,campaigns(name)')
            .eq('contact_id', id)
            .order('created_at', { ascending: false })
            .range(start, start + size - 1),
        ]);
        return { ...row, imports: checked(imports), deliveries: checked(deliveries) };
      }
      if (method === 'PATCH')
        return checked(
          await db
            .from('contacts')
            .update(
              z
                .object({ name: z.string().max(200).optional(), status: status.optional() })
                .parse(data),
            )
            .eq('id', id)
            .select()
            .single(),
        );
    }
  }
  if (resource === 'imports') {
    if (method === 'POST' && !id) {
      const input = z
        .object({
          summary: z.object({
            filename: z.string().max(255),
            totalRows: z.number().int().min(0),
            totalEmailsDetected: z.number().int().min(0),
            duplicatesRemoved: z.number().int().min(0),
            invalidEmails: z.number().int().min(0),
            blankCells: z.number().int().min(0),
            emailColumns: z
              .array(
                z.object({
                  sheet: z.string().max(255),
                  column: z.string().max(10),
                  confidence: z.number().min(0).max(100),
                }),
              )
              .max(2000),
          }),
          recipients: z
            .array(
              z.object({
                email: email.refine((e) => isValidEmail(e)),
                source: z.object({
                  sheet: z.string().max(255),
                  row: z.number().int().positive(),
                  column: z
                    .string()
                    .regex(/^[A-Z]+$/)
                    .max(10),
                }),
              }),
            )
            .min(1)
            .max(10000),
        })
        .parse(data);
      input.recipients = [...new Map(input.recipients.map((r) => [r.email, r])).values()];
      const result = checked(
        await db.rpc('import_recipients', {
          p_user: user.id,
          p_summary: input.summary,
          p_recipients: input.recipients,
        }),
      );
      return { id: result };
    }
    if (id && method === 'GET') {
      const record = await owned('imports', id, user.id);
      const result = await db
        .from('import_contacts')
        .select('*,contacts(email,status)', { count: 'exact' })
        .eq('import_id', id)
        .range(start, start + size - 1);
      return { ...record, items: checked(result), count: result.count };
    }
  }
  if (resource === 'templates') {
    if (id === 'seed' && method === 'POST') {
      const count = checked(
        await db
          .from('templates')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_starter', true)
          .limit(1),
      );
      if (!count?.length)
        checked(
          await db
            .from('templates')
            .insert(starterTemplates.map((t) => ({ ...t, user_id: user.id, is_starter: true }))),
        );
      return { ok: true };
    }
    if (method === 'POST' && !id) {
      const input = templateInput.parse(data);
      return checked(
        await db
          .from('templates')
          .insert({ ...input, body_html: cleanHtml(input.body_html), user_id: user.id })
          .select()
          .single(),
      );
    }
    if (id) {
      const row = await owned('templates', id, user.id);
      if (method === 'GET') return row;
      if (method === 'PATCH') {
        const input = templateInput.parse(data);
        return checked(
          await db
            .from('templates')
            .update({ ...input, body_html: cleanHtml(input.body_html) })
            .eq('id', id)
            .select()
            .single(),
        );
      }
      if (method === 'DELETE') {
        checked(await db.from('templates').delete().eq('id', id));
        return { ok: true };
      }
    }
  }
  if (resource === 'campaigns') {
    if ((method === 'POST' && !id) || (method === 'PATCH' && id && !action)) {
      if (id) await owned('campaigns', id, user.id);
      const input = campaignInput.parse(data);
      await ownedContacts(user.id, input.contact_ids);
      if (input.sender_id) await owned('sender_identities', input.sender_id, user.id);
      if (
        input.attachments.reduce((n, a) => n + a.size, 0) > 10485760 ||
        input.attachments.some((a) => !a.path.startsWith(user.id + '/') || a.path.includes('..'))
      )
        throw new HttpError(400, 'Invalid attachments.');
      await loadAttachments(user.id, input.attachments);
      const campaign = checked(
        await db.rpc('save_campaign', {
          p_user: user.id,
          p_id: id || null,
          p_data: { ...input, body_html: cleanHtml(input.body_html) },
          p_contacts: [...new Set(input.contact_ids)],
        }),
      );
      return { id: campaign };
    }
    if (id) {
      const row = await owned('campaigns', id, user.id);
      if (action === 'recipients' && method === 'GET') {
        const r = await db
          .from('campaign_recipients')
          .select('contact_id', { count: 'exact' })
          .eq('campaign_id', id)
          .range(start, start + size - 1);
        return { items: checked(r), count: r.count };
      }
      if (action === 'status' && method === 'GET') {
        const stats: Record<string, number> = {};
        for (const s of [
          'queued',
          'sending',
          'sent',
          'delivered',
          'failed',
          'bounced',
          'complained',
          'skipped',
        ]) {
          const r = await db
            .from('email_queue')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', id)
            .eq('status', s);
          checked(r);
          stats[s] = r.count || 0;
        }
        return { ...row, stats };
      }
      if (action === 'deliveries' && method === 'GET') {
        let query = db.from('email_queue').select('*', { count: 'exact' }).eq('campaign_id', id);
        if (q.get('search'))
          query = query.ilike('recipient_email', `%${q.get('search')!.replace(/[%_\\]/g, '')}%`);
        if (q.get('status')) query = query.eq('status', q.get('status'));
        const result = await query
          .order('created_at', { ascending: false })
          .range(start, start + size - 1);
        return { items: checked(result), count: result.count };
      }
      if (action === 'send' && method === 'POST') {
        await limit(user.id, 'send', 10);
        if (!row.sender_id) throw new HttpError(400, 'Select a sender.');
        await verifySender(user.id, row.sender_id);
        await providerFor(user.id);
        const scheduled = data.scheduled_at
          ? z.string().datetime({ offset: true }).parse(data.scheduled_at)
          : null;
        if (scheduled && new Date(scheduled).getTime() <= Date.now())
          throw new HttpError(400, 'Schedule must be in the future.');
        const total = checked(
          await db.rpc('enqueue_campaign', { p_user: user.id, p_id: id, p_schedule: scheduled }),
        );
        return { status: scheduled ? 'scheduled' : 'sending', total };
      }
      if (action === 'test' && method === 'POST') {
        await limit(user.id, 'test', 10);
        if (!row.sender_id || !user.email)
          throw new HttpError(400, 'A sender and account email are required.');
        const sender = await verifySender(user.id, row.sender_id);
        const provider = await providerFor(user.id);
        return provider.sendEmail(
          {
            from: `${sender.from_name.replace(/[<>\r\n"]/g, '')} <${sender.from_email}>`,
            to: user.email,
            subject: `[Test] ${row.subject}`,
            html: row.body_html,
            text: row.body_text,
            replyTo: row.reply_to || undefined,
            attachments: await loadAttachments(user.id, row.attachments || []),
          },
          `test-${crypto.randomUUID()}`,
        );
      }
      if (action === 'duplicate' && method === 'POST') {
        const copy = checked(await db.rpc('duplicate_campaign', { p_user: user.id, p_id: id }));
        return { id: copy };
      }
      if (action === 'pause' && method === 'POST') {
        checked(
          await db
            .from('campaigns')
            .update({ status: 'paused' })
            .eq('id', id)
            .in('status', ['scheduled', 'sending']),
        );
        return { ok: true };
      }
      if (action === 'resume' && method === 'POST') {
        checked(
          await db
            .from('campaigns')
            .update({ status: row.started_at ? 'sending' : 'scheduled' })
            .eq('id', id)
            .eq('status', 'paused'),
        );
        return { ok: true };
      }
      if (method === 'DELETE' && !action) {
        if (!['draft', 'failed', 'sent'].includes(row.status))
          throw new HttpError(409, 'Only drafts and finished campaigns can be deleted.');
        checked(await db.from('campaigns').delete().eq('id', id));
        return { ok: true };
      }
      if (method === 'GET' && !action) return row;
    }
  }
  if (resource === 'settings') {
    if (id === 'senders') {
      if (method === 'GET')
        return {
          items: checked(
            await db
              .from('sender_identities')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at')
              .limit(100),
          ),
        };
      if (method === 'POST' && !action) {
        const input = z
          .object({
            from_name: z.string().trim().min(1).max(100),
            from_email: email,
            reply_to: z.union([email, z.literal('')]).default(''),
          })
          .parse(data);
        return checked(
          await db
            .from('sender_identities')
            .insert({ ...input, user_id: user.id, verified: false })
            .select()
            .single(),
        );
      }
      if (action) {
        await owned('sender_identities', action, user.id);
        if (method === 'POST') return verifySender(user.id, action);
        if (method === 'PATCH') {
          checked(await db.rpc('default_sender', { p_user: user.id, p_id: action }));
          return { ok: true };
        }
        if (method === 'DELETE') {
          checked(await db.from('sender_identities').delete().eq('id', action));
          return { ok: true };
        }
      }
    }
    if (!id && method === 'GET') {
      const row = checked(
        await db
          .from('user_settings')
          .select('send_rate,timezone,provider_key_encrypted')
          .eq('user_id', user.id)
          .maybeSingle(),
      );
      return {
        send_rate: row?.send_rate || 1,
        timezone: row?.timezone || 'UTC',
        has_provider_key: !!row?.provider_key_encrypted,
        email: user.email,
        name: user.user_metadata?.full_name || '',
        avatar_url: user.user_metadata?.avatar_url || '',
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin}/api/webhooks/resend?user=${user.id}`,
      };
    }
    if (!id && method === 'PATCH') {
      const input = z
        .object({
          send_rate: z.number().int().min(1).max(10),
          timezone: z.string().max(100),
          api_key: z.string().max(300).optional(),
          webhook_secret: z.string().max(300).optional(),
          name: z.string().max(200).optional(),
          avatar_url: z.union([z.string().url().startsWith('https://'), z.literal('')]).optional(),
        })
        .parse(data);
      try {
        new Intl.DateTimeFormat('en', { timeZone: input.timezone });
      } catch {
        throw new HttpError(400, 'Invalid timezone.');
      }
      if (input.api_key) {
        const pending = await db
          .from('email_queue')
          .select('id,campaigns!inner(user_id)', { count: 'exact', head: true })
          .eq('campaigns.user_id', user.id)
          .in('status', ['queued', 'sending']);
        checked(pending);
        if (pending.count)
          throw new HttpError(409, 'Finish pending deliveries before replacing your provider key.');
        checked(
          await db.from('sender_identities').update({ verified: false }).eq('user_id', user.id),
        );
      }
      checked(
        await db.from('user_settings').upsert({
          user_id: user.id,
          send_rate: input.send_rate,
          timezone: input.timezone,
          ...(input.api_key ? { provider_key_encrypted: encrypt(input.api_key) } : {}),
          ...(input.webhook_secret
            ? { webhook_secret_encrypted: encrypt(input.webhook_secret) }
            : {}),
        }),
      );
      if (input.name !== undefined) {
        const result = await db.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            full_name: input.name,
            avatar_url: input.avatar_url,
          },
        });
        if (result.error) throw result.error;
      }
      return { ok: true };
    }
  }
  if (resource === 'automations') {
    if ((method === 'POST' && !id) || (method === 'PATCH' && id && !action)) {
      const input = automationInput.parse(data);
      await owned('sender_identities', input.sender_id, user.id);
      for (const s of input.steps)
        if (s.step_type === 'send_email') await owned('templates', s.config.template_id, user.id);
      if (input.trigger_config.group_id)
        await owned('contact_groups', input.trigger_config.group_id, user.id);
      if (input.trigger_type === 'scheduled') {
        try {
          CronExpressionParser.parse(input.trigger_config.schedule_cron || '', {
            tz: input.trigger_config.timezone,
          }).next();
        } catch {
          throw new HttpError(400, 'Enter a valid cron schedule and timezone.');
        }
      }
      if (id) {
        const row = await owned('automations', id, user.id);
        if (row.status !== 'draft') throw new HttpError(409, 'Only draft workflows can be edited.');
      }
      const result = checked(
        await db.rpc('save_automation', { p_user: user.id, p_id: id || null, p_data: input }),
      );
      return { id: result };
    }
    if (id) {
      const row = await owned('automations', id, user.id);
      if (method === 'GET' && !action)
        return {
          ...row,
          steps: checked(
            await db
              .from('automation_steps')
              .select('*')
              .eq('automation_id', id)
              .order('step_order'),
          ),
        };
      if (method === 'GET' && action === 'enrollments') {
        const result = await db
          .from('automation_enrollments')
          .select('*,contacts(email)', { count: 'exact' })
          .eq('automation_id', id)
          .order('enrolled_at', { ascending: false })
          .range(start, start + size - 1);
        const stats: Record<string, number> = {};
        for (const status of ['active', 'completed', 'paused', 'exited']) {
          const count = await db
            .from('automation_enrollments')
            .select('id', { count: 'exact', head: true })
            .eq('automation_id', id)
            .eq('status', status);
          checked(count);
          stats[status] = count.count || 0;
        }
        return { items: checked(result), count: result.count, stats };
      }
      if (method === 'POST' && action === 'enroll') {
        const selected = ids.parse(data.ids);
        await ownedContacts(user.id, selected);
        if (row.status !== 'active') throw new HttpError(409, 'Activate the workflow first.');
        checked(
          await db.from('automation_enrollments').upsert(
            selected.map((contact_id) => ({
              automation_id: id,
              contact_id,
              next_action_at: new Date().toISOString(),
            })),
            { onConflict: 'automation_id,contact_id', ignoreDuplicates: true },
          ),
        );
        return { ok: true };
      }
      if (method === 'POST' && action === 'activate') {
        await verifySender(user.id, row.sender_id);
        const config = row.trigger_config;
        const next =
          row.trigger_type === 'scheduled'
            ? CronExpressionParser.parse(config.schedule_cron, { tz: config.timezone })
                .next()
                .toISOString()
            : null;
        checked(
          await db.from('automations').update({ status: 'active', next_run_at: next }).eq('id', id),
        );
        return { ok: true };
      }
      if (method === 'POST' && action === 'pause') {
        checked(await db.from('automations').update({ status: 'paused' }).eq('id', id));
        return { ok: true };
      }
      if (method === 'DELETE') {
        if (row.status === 'active')
          throw new HttpError(409, 'Pause this workflow before deleting it.');
        checked(await db.from('automations').delete().eq('id', id));
        return { ok: true };
      }
    }
  }
  if (
    ['imports', 'templates', 'campaigns', 'automations'].includes(resource) &&
    !id &&
    method === 'GET'
  ) {
    let query = db
      .from(resource)
      .select(
        resource === 'automations'
          ? '*,automation_steps(count),automation_enrollments(count)'
          : '*',
        { count: 'exact' },
      )
      .eq('user_id', user.id);
    if (q.get('search'))
      query = query.ilike(
        resource === 'imports' ? 'filename' : 'name',
        `%${q.get('search')!.replace(/[%_\\]/g, '')}%`,
      );
    if (q.get('status')) query = query.eq('status', q.get('status'));
    if (q.get('category')) query = query.eq('category', q.get('category'));
    const result = await query
      .order('created_at', { ascending: false })
      .range(start, start + size - 1);
    return { items: checked(result), count: result.count };
  }
  throw new HttpError(404, 'Endpoint not found.');
}
