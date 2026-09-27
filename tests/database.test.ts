import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { processWorkbook } from '@/lib/spreadsheet/processWorkbook';
const user = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222';
let db: PGlite, contact: string, sender: string, campaign: string;
async function scalar<T>(sql: string, args: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, args);
  return Object.values(r.rows[0])[0];
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);grant usage on schema public,auth to authenticated,anon;alter default privileges in schema public grant all on tables to authenticated,anon;`,
  );
  await db.exec(
    readFileSync('supabase/schema.sql', 'utf8').replace(
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
      '',
    ),
  );
  for (const file of readdirSync('supabase/migrations').sort())
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'));
  await db.query('insert into auth.users values($1),($2)', [user, other]);
  sender = await scalar(
    "insert into sender_identities(user_id,from_name,from_email,verified) values($1,'Sender','sender@acme.org',true) returning id",
    [user],
  );
});
afterAll(async () => {
  await db?.close();
});
describe.sequential('database integration: import → campaign → queue → delivery', () => {
  it('imports real parser output transactionally and preserves suppression on reimport', async () => {
    const buffer = new TextEncoder().encode(
      'Email\nfirst@acme.org\nsecond@acme.org\nfirst@acme.org',
    ).buffer;
    const result = await processWorkbook(buffer, 'contacts.csv');
    const imported = await scalar<string>('select import_recipients($1,$2,$3)', [
      user,
      JSON.stringify(result.summary),
      JSON.stringify(result.recipients),
    ]);
    expect(await scalar<number>('select count(*)::int from contacts')).toBe(2);
    contact = await scalar("select id from contacts where email='first@acme.org'");
    await db.query("update contacts set status='unsubscribed' where id=$1", [contact]);
    await scalar('select import_recipients($1,$2,$3)', [
      user,
      JSON.stringify(result.summary),
      JSON.stringify(result.recipients),
    ]);
    expect(await scalar('select status from contacts where id=$1', [contact])).toBe('unsubscribed');
    expect(
      await scalar<number>('select count(*)::int from import_contacts where import_id=$1', [
        imported,
      ]),
    ).toBe(2);
  });
  it('rejects cross-tenant recipients and rolls back the campaign', async () => {
    const data = {
      name: 'Cross tenant',
      subject: 'Hello',
      from_name: 'Sender',
      body_html: '<p>Hello</p>',
      sender_id: sender,
    };
    await expect(
      scalar('select save_campaign($1,null,$2,$3)', [other, JSON.stringify(data), [contact]]),
    ).rejects.toThrow();
    expect(
      await scalar<number>('select count(*)::int from campaigns where user_id=$1', [other]),
    ).toBe(0);
  });
  it('creates a draft and enqueues active recipients exactly once', async () => {
    const contacts = (
      await db.query<{ id: string }>('select id from contacts where user_id=$1', [user])
    ).rows.map((r) => r.id);
    campaign = await scalar('select save_campaign($1,null,$2,$3)', [
      user,
      JSON.stringify({
        name: 'Campaign',
        subject: 'Hello',
        from_name: 'Sender',
        body_html: '<p>Hello</p>',
        sender_id: sender,
      }),
      contacts,
    ]);
    expect(await scalar('select enqueue_campaign($1,$2)', [user, campaign])).toBe(1);
    expect(await scalar('select enqueue_campaign($1,$2)', [user, campaign])).toBe(1);
    expect(
      await scalar<number>('select count(*)::int from email_queue where campaign_id=$1', [
        campaign,
      ]),
    ).toBe(1);
    await expect(
      scalar('select save_campaign($1,$2,$3,$4)', [
        user,
        campaign,
        JSON.stringify({ name: 'Mutated' }),
        contacts,
      ]),
    ).rejects.toThrow('Only drafts');
  });
  it('claims one item, excludes a live lease, and reclaims an expired lease', async () => {
    const claimed = (
      await db.query<{ id: string; lease_token: string }>('select * from claim_email()')
    ).rows[0];
    expect(claimed.id).toBeTruthy();
    expect((await db.query('select * from claim_email()')).rows).toHaveLength(0);
    await db.query("update email_queue set attempted_at=now()-interval '11 minutes' where id=$1", [
      claimed.id,
    ]);
    const recovered = (await db.query<{ lease_token: string }>('select * from claim_email()'))
      .rows[0];
    expect(recovered.lease_token).not.toBe(claimed.lease_token);
    await db.query(
      "update email_queue set status='sent',provider_message_id='message-1',sent_at=now() where id=$1",
      [claimed.id],
    );
  });
  it('applies signed-event records idempotently and prevents delivery downgrading complaints', async () => {
    for (const [id, type] of [
      ['evt1', 'email.delivered'],
      ['evt2', 'email.complained'],
      ['evt3', 'email.delivered'],
    ]) {
      await db.query(
        "insert into delivery_logs(event_id,provider_message_id,event_type,payload,owner_id) values($1,'message-1',$2,'{}',$3)",
        [id, type, user],
      );
      await scalar('select apply_delivery_event($1)', [id]);
      await scalar('select apply_delivery_event($1)', [id]);
    }
    expect(
      await scalar("select status from email_queue where provider_message_id='message-1'"),
    ).toBe('complained');
    expect(await scalar("select status from contacts where email='second@acme.org'")).toBe(
      'unsubscribed',
    );
    expect(await scalar('select sent_count from campaigns where id=$1', [campaign])).toBe(1);
  });
  it('denies a webhook event from a different account', async () => {
    await db.query(
      "insert into delivery_logs(event_id,provider_message_id,event_type,payload,owner_id) values('foreign','message-1','email.bounced','{}',$1)",
      [other],
    );
    expect(await scalar("select apply_delivery_event('foreign')")).toBe(false);
  });
  it('enforces RLS and removes browser mutation/RPC privileges', async () => {
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${other}',false);`,
    );
    expect(await scalar<number>('select count(*)::int from contacts')).toBe(0);
    await expect(db.query('update sender_identities set verified=true')).rejects.toThrow(
      'permission denied',
    );
    await expect(db.query('select claim_email()')).rejects.toThrow('permission denied');
    await expect(db.query('select * from user_settings')).rejects.toThrow('permission denied');
    await db.exec('reset role');
  });
  it('advances workflow steps transactionally without creating duplicate sends', async () => {
    await db.query("update contacts set status='active' where id=$1", [contact]);
    const template = await scalar(
      "insert into templates(user_id,name,subject,body_html) values($1,'T','Hello','<p>Hello</p>') returning id",
      [user],
    );
    const automation = await scalar('select save_automation($1,null,$2)', [
      user,
      JSON.stringify({
        name: 'Sequence',
        trigger_type: 'manual',
        sender_id: sender,
        trigger_config: {},
        steps: [
          { step_type: 'send_email', config: { template_id: template } },
          { step_type: 'wait', config: { duration_hours: 48 } },
          { step_type: 'condition', config: { status: 'active', operator: 'equals' } },
        ],
      }),
    ]);
    await db.query("update automations set status='active' where id=$1", [automation]);
    const enrollment = await scalar(
      'insert into automation_enrollments(automation_id,contact_id,next_action_at) values($1,$2,now()) returning id',
      [automation, contact],
    );
    await scalar('select advance_automation($1)', [enrollment]);
    await scalar('select advance_automation($1)', [enrollment]);
    await scalar('select advance_automation($1)', [enrollment]);
    expect(
      await scalar('select step_index from automation_enrollments where id=$1', [enrollment]),
    ).toBe(2);
    expect(
      await scalar<number>("select count(*)::int from campaigns where name like 'Sequence%'"),
    ).toBe(1);
  });
  it('aggregates campaign analytics in SQL', async () => {
    const r = await scalar<{ contacts: number; sent: number }>('select analytics_report($1)', [
      user,
    ]);
    expect(r.contacts).toBe(2);
    expect(r.sent).toBe(1);
  });
  it('does not retry uncertain delivery after the idempotency recovery window', async () => {
    const pending = await scalar<string>(
      "select id from email_queue where status='queued' limit 1",
    );
    await db.query(
      "update email_queue set first_attempt_at=now()-interval '24 hours' where id=$1",
      [pending],
    );
    expect((await db.query('select * from claim_email()')).rows).toHaveLength(0);
    expect(await scalar('select status from email_queue where id=$1', [pending])).toBe('failed');
  });
  it('reconciles only known webhook messages without starving on unmatched events', async () => {
    await db.query(
      "insert into delivery_logs(event_id,provider_message_id,event_type,payload,owner_id) values('unmatched','not-a-queue-message','email.delivered','{}',$1),('known','message-1','email.delivered','{}',$1)",
      [user],
    );
    expect(await scalar('select reconcile_delivery_events()')).toBe(1);
    expect(
      await scalar("select processed_at is null from delivery_logs where event_id='unmatched'"),
    ).toBe(true);
  });
});
