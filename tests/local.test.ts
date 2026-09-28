import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
let dir: string;
let local: typeof import('@/lib/local/database');
const owner = '11111111-1111-4111-8111-111111111111';
let contact: string, group: string, template: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'mailautomator-local-'));
  vi.stubEnv('LOCAL_DATA_DIR', dir);
  vi.stubEnv('LOCAL_SESSION_SECRET', 'a'.repeat(64));
  vi.stubEnv('LOCAL_LOGIN_PASSWORD', 'TemporaryTest!123');
  vi.stubEnv('LOCAL_LOGIN_EMAIL', 'admin@local.test');
  local = await import('@/lib/local/database');
  await local.database();
});
afterAll(async () => {
  if (!(await local.database()).closed) await (await local.database()).close();
  await rm(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
describe.sequential('persistent local workspace', () => {
  it('authenticates the configured password and rejects altered and expired sessions', async () => {
    const auth = await import('@/lib/local/auth');
    expect(auth.validCredentials('admin@local.test', 'TemporaryTest!123')).toBe(true);
    expect(auth.validCredentials('admin@local.test', 'wrong')).toBe(false);
    const token = auth.issueSession();
    expect(auth.verifySession(token)).toBe(true);
    expect(auth.verifySession(token + 'x')).toBe(false);
    expect(auth.verifySession('')).toBe(false);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 86400000);
    expect(auth.verifySession(token)).toBe(false);
    vi.restoreAllMocks();
  });
  it('saves contacts and nested group relations with accurate pagination', async () => {
    const db = local.localDatabase;
    const c = await db
      .from('contacts')
      .insert({ user_id: owner, email: 'reader@acme.org', name: 'Reader' })
      .select()
      .single();
    expect(c.error).toBeNull();
    contact = c.data.id;
    const g = await db
      .from('contact_groups')
      .insert({ user_id: owner, name: 'Readers' })
      .select()
      .single();
    group = g.data.id;
    expect(
      (
        await db
          .from('contact_group_members')
          .upsert({ contact_id: contact, group_id: group }, { onConflict: 'group_id,contact_id' })
      ).error,
    ).toBeNull();
    const list = await db
      .from('contacts')
      .select(
        '*, imports(filename), contact_group_members!inner(group_id,contact_groups(name,color))',
        { count: 'exact' },
      )
      .eq('contact_group_members.group_id', group)
      .ilike('email', '%acme%')
      .order('email')
      .range(0, 9);
    expect(list.error).toBeNull();
    expect(list.count).toBe(1);
    expect(list.data[0].contact_group_members[0].contact_groups.name).toBe('Readers');
    expect((await db.from('contacts').select('*', { count: 'exact' }).range(10, 19)).count).toBe(1);
  });
  it('runs import and campaign transactions and aggregates analytics', async () => {
    const db = local.localDatabase;
    const imported = await db.rpc('import_recipients', {
      p_user: owner,
      p_summary: {
        filename: 'local.csv',
        totalRows: 1,
        totalEmailsDetected: 1,
        duplicatesRemoved: 0,
        invalidEmails: 0,
        blankCells: 0,
        emailColumns: [],
      },
      p_recipients: [
        { email: 'second@acme.org', source: { sheet: 'Sheet1', row: 1, column: 'A' } },
      ],
    });
    expect(imported.error).toBeNull();
    const result = await db.rpc('save_campaign', {
      p_user: owner,
      p_id: null,
      p_data: {
        name: 'Local draft',
        subject: 'Hello',
        body_html: '<p>Hello</p>',
        from_name: 'Owner',
        attachments: [],
      },
      p_contacts: [contact],
    });
    expect(result.error).toBeNull();
    expect((await db.from('campaigns').select('*').eq('id', result.data).single()).data.name).toBe(
      'Local draft',
    );
    const analytics = await db.rpc('analytics_report', { p_user: owner });
    expect(analytics.error).toBeNull();
    expect(analytics.data.contacts).toBe(2);
    const claim = await db.rpc('claim_email');
    expect(claim.error).toBeNull();
    expect(claim.data).toEqual([]);
  });
  it('saves settings and templates, updates, deletes, and stores attachments', async () => {
    const db = local.localDatabase;
    expect(
      (
        await db
          .from('user_settings')
          .upsert({ user_id: owner, timezone: 'Asia/Calcutta', send_rate: 1 })
      ).error,
    ).toBeNull();
    expect(
      (await db.from('user_settings').upsert({ user_id: owner, timezone: 'UTC', send_rate: 2 }))
        .error,
    ).toBeNull();
    const t = await db
      .from('templates')
      .insert({ user_id: owner, name: 'Saved template', subject: 'Hi', body_html: '<p>Hi</p>' })
      .select()
      .single();
    expect(t.error).toBeNull();
    template = t.data.id;
    expect(
      (await db.from('templates').update({ name: 'Updated' }).eq('id', template).select().single())
        .data.name,
    ).toBe('Updated');
    const key = owner + '/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa.txt';
    await db.storage.from('campaign-attachments').upload(key, Buffer.from('attachment'));
    expect(await (await db.storage.from('campaign-attachments').download(key)).data?.text()).toBe(
      'attachment',
    );
    await expect(
      db.storage.from('campaign-attachments').upload('../secret', Buffer.from('x')),
    ).rejects.toThrow();
    expect((await db.from('contacts').delete().eq('id', contact)).error).toBeNull();
    expect((await db.from('contact_group_members').select('*').eq('group_id', group)).data).toEqual(
      [],
    );
  });
  it('runs the background worker queries without cloud services', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCAL_MODE', 'true');
    vi.stubEnv('CRON_SECRET', 'local-test-cron-secret');
    // The config was imported before this override, so exercise its full SQL path directly.
    const db = local.localDatabase;
    const token = crypto.randomUUID();
    const acquired = await db.rpc('acquire_worker', { p_token: token });
    expect(acquired.error).toBeNull();
    expect(acquired.data).toBe(true);
    const due = await db
      .from('automation_enrollments')
      .select('id,automations!inner(status)')
      .eq('status', 'active')
      .eq('automations.status', 'active')
      .lte('next_action_at', new Date().toISOString())
      .order('next_action_at')
      .limit(100);
    expect(due.error).toBeNull();
    expect(due.data).toEqual([]);
    expect((await db.rpc('reconcile_delivery_events')).error).toBeNull();
    expect(
      (
        await db
          .from('worker_locks')
          .update({ expires_at: null, token: null })
          .eq('name', 'delivery')
          .eq('token', token)
      ).error,
    ).toBeNull();
  });
  it('persists records after closing and reopening the database', async () => {
    await (await local.database()).close();
    const reopened = new PGlite(path.join(dir, 'postgres'));
    expect(
      (await reopened.query<{ name: string }>('select name from templates where id=$1', [template]))
        .rows[0].name,
    ).toBe('Updated');
    await reopened.close();
  });
});
