'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Campaign, Attachment, Sender, Template, List } from '@/lib/models';
import { RecipientPicker } from './contacts';
import {
  Heading,
  Panel,
  State,
  Field,
  Preview,
  Pagination,
  api,
  action,
  useResource,
} from './shared';
const EmailEditor = dynamic(() => import('@/components/email/EmailEditor'), { ssr: false });
export function Composer({ id }: { id?: string }) {
  const campaign = useResource<Campaign>(id ? 'campaigns/' + id : null);
  if (id && !campaign.data)
    return <State loading={campaign.loading} error={campaign.error} retry={campaign.reload} />;
  if (campaign.data && campaign.data.status !== 'draft')
    return <State error="Only draft campaigns can be edited." />;
  return id ? <DraftLoader key={id} campaign={campaign.data!} /> : <ComposeForm initial={null} />;
}
function DraftLoader({ campaign }: { campaign: Campaign }) {
  const [recipients, setRecipients] = useState<string[] | null>(null),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      const selected: string[] = [];
      for (let page = 1; page <= 100; page++) {
        const r = await api<List<{ contact_id: string }>>(
          `campaigns/${campaign.id}/recipients?page=${page}&size=100`,
        );
        selected.push(...r.items.map((i) => i.contact_id));
        if (page * 100 >= r.count) break;
      }
      if (active) {
        setRecipients(selected);
        setError('');
      }
    }
    load().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [campaign.id, attempt]);
  if (!recipients)
    return <State loading={!error} error={error} retry={() => setAttempt(attempt + 1)} />;
  return <ComposeForm initial={campaign} initialRecipients={recipients} />;
}
function ComposeForm({
  initial,
  initialRecipients = [],
}: {
  initial: Campaign | null;
  initialRecipients?: string[];
}) {
  const [step, setStep] = useState(1),
    [selected, setSelected] = useState<string[]>(initialRecipients),
    [name, setName] = useState(initial?.name || ''),
    [subject, setSubject] = useState(initial?.subject || ''),
    [senderId, setSenderId] = useState(initial?.sender_id || ''),
    [fromName, setFromName] = useState(initial?.from_name || ''),
    [replyTo, setReplyTo] = useState(initial?.reply_to || ''),
    [html, setHtml] = useState(initial?.body_html || ''),
    [text, setText] = useState(initial?.body_text || ''),
    [attachments, setAttachments] = useState<Attachment[]>(initial?.attachments || []),
    [busy, setBusy] = useState(false),
    [savedId, setSavedId] = useState(initial?.id || ''),
    [picker, setPicker] = useState(false),
    [confirmSend, setConfirmSend] = useState(false),
    [schedule, setSchedule] = useState(false),
    [scheduledAt, setScheduledAt] = useState(''),
    [templatePage, setTemplatePage] = useState(1);
  const senders = useResource<List<Sender>>('settings/senders'),
    templates = useResource<List<Template>>(`templates?page=${templatePage}`),
    router = useRouter();
  const effectiveSenderId =
    senderId || (!initial ? senders.data?.items.find((s) => s.is_default)?.id : '') || '';
  const effectiveFromName =
    fromName || senders.data?.items.find((s) => s.id === effectiveSenderId)?.from_name || '';
  async function loadSavedRecipients() {
    if (!initial) return;
    await action(async () => {
      const contacts: string[] = [];
      for (let p = 1; p <= 100; p++) {
        const r = await api<List<{ contact_id: string }>>(
          `campaigns/${initial.id}/recipients?page=${p}&size=100`,
        );
        contacts.push(...r.items.map((i) => i.contact_id));
        if (p * 100 >= r.count) break;
      }
      setSelected(contacts);
    }, 'Saved recipients loaded');
  }
  async function save() {
    const sender = senders.data?.items.find((s) => s.id === effectiveSenderId);
    const result = await api<{ id: string }>(
      savedId ? 'campaigns/' + savedId : 'campaigns',
      savedId ? 'PATCH' : 'POST',
      {
        name,
        subject,
        sender_id: effectiveSenderId || null,
        from_name: fromName || sender?.from_name || '',
        reply_to: replyTo,
        body_html: html,
        body_text: text,
        contact_ids: selected,
        attachments,
      },
    );
    setSavedId(result.id);
    return result.id;
  }
  async function finish(mode: 'draft' | 'send' | 'schedule' | 'test') {
    setBusy(true);
    await action(
      async () => {
        if (
          mode !== 'draft' &&
          (!selected.length || !subject.trim() || !html || !effectiveSenderId)
        )
          throw new Error('Select recipients, a sender, and add a subject and body.');
        const id = await save();
        if (mode === 'send' || mode === 'schedule')
          await api(
            `campaigns/${id}/send`,
            'POST',
            mode === 'schedule' ? { scheduled_at: new Date(scheduledAt).toISOString() } : {},
          );
        if (mode === 'test') await api(`campaigns/${id}/test`, 'POST', {});
        else router.push('/campaigns/' + id);
      },
      mode === 'test'
        ? 'Test email sent to your account'
        : mode === 'draft'
          ? 'Draft saved'
          : 'Campaign queued',
    );
    setBusy(false);
    setConfirmSend(false);
    setSchedule(false);
  }
  return (
    <>
      <Heading
        title={initial ? 'Edit campaign' : 'New campaign'}
        description="Choose your audience. Write your message. Review every detail."
      />
      <div className="mb-7 flex gap-3">
        {['Recipients', 'Compose', 'Preview'].map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i + 1)}
            className={
              'flex-1 rounded-xl border p-3 text-sm font-medium ' +
              (step === i + 1
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-400')
            }
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>
      {step === 1 && (
        <Panel>
          <div className="mb-5">
            <Field label="Campaign name">
              <input
                className="control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="September community update"
              />
            </Field>
          </div>
          {initial && (
            <Button className="mb-4" variant="outline" onClick={loadSavedRecipients}>
              Load saved recipients
            </Button>
          )}
          <RecipientPicker selected={selected} onChange={setSelected} />
        </Panel>
      )}
      {step === 2 && (
        <Panel>
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sender identity">
                <select
                  className="control"
                  value={effectiveSenderId}
                  onChange={(e) => {
                    setSenderId(e.target.value);
                    const s = senders.data?.items.find((s) => s.id === e.target.value);
                    if (s) {
                      setFromName(s.from_name);
                      setReplyTo(s.reply_to || '');
                    }
                  }}
                >
                  <option value="">Select a sender…</option>
                  {senders.data?.items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.from_email}
                      {s.verified ? ' ✓' : ' (unverified)'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="From name">
                <input
                  className="control"
                  value={effectiveFromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
              </Field>
              <Field label="Reply-to email">
                <input
                  type="email"
                  className="control"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                />
              </Field>
              <Field label={`Subject · ${subject.length} characters`}>
                <input
                  className="control"
                  value={subject}
                  maxLength={500}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPicker(true)}>
                Load template
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const templateName = prompt('Template name');
                  if (templateName)
                    action(
                      () =>
                        api('templates', 'POST', {
                          name: templateName,
                          category: 'custom',
                          subject,
                          body_html: html,
                          body_text: text,
                        }),
                      'Template saved',
                    );
                }}
              >
                Save as template
              </Button>
            </div>
            <EmailEditor
              value={html}
              onChange={(h, t) => {
                setHtml(h);
                setText(t);
              }}
            />
            <Field label="Attachments · 10 MB total (PDF, PNG, JPG, TXT, CSV)">
              <input
                type="file"
                disabled={busy}
                accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  await action(async () => {
                    if (attachments.reduce((n, a) => n + a.size, 0) + file.size > 10485760)
                      throw new Error('Attachments must total 10 MB or less.');
                    const upload = await api<Attachment & { token: string }>(
                      'attachments/sign',
                      'POST',
                      { filename: file.name, size: file.size },
                    );
                    const { error } = await createClient()
                      .storage.from('campaign-attachments')
                      .uploadToSignedUrl(upload.path, upload.token, file, {
                        contentType: upload.mime,
                      });
                    if (error) throw error;
                    setAttachments([
                      ...attachments,
                      {
                        filename: upload.filename,
                        path: upload.path,
                        size: upload.size,
                        mime: upload.mime,
                      },
                    ]);
                  }, 'Attachment uploaded');
                  setBusy(false);
                  e.target.value = '';
                }}
              />
            </Field>
            {attachments.map((a, i) => (
              <div
                key={a.path}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-sm"
              >
                <span>
                  {a.filename} · {(a.size / 1024).toFixed(0)} KB
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setAttachments(attachments.filter((_, n) => n !== i))}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {step === 3 && (
        <Panel>
          <div className="mb-5 grid gap-2 text-sm">
            <p>
              <strong>From:</strong> {effectiveFromName} &lt;
              {senders.data?.items.find((s) => s.id === effectiveSenderId)?.from_email ||
                'Choose a sender'}
              &gt;
            </p>
            <p>
              <strong>Reply-to:</strong> {replyTo || 'Sender address'}
            </p>
            <p>
              <strong>Subject:</strong> {subject || 'No subject'}
            </p>
            <p>
              <strong>Recipients:</strong> {selected.length.toLocaleString()} active contacts
              selected
            </p>
            <p>
              <strong>Attachments:</strong>{' '}
              {attachments.map((a) => a.filename).join(', ') || 'None'}
            </p>
          </div>
          <Preview html={html} />
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" disabled={busy} onClick={() => finish('test')}>
              Send test to myself
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setSchedule(true)}>
              Schedule
            </Button>
            <Button disabled={busy} onClick={() => setConfirmSend(true)}>
              Send now
            </Button>
          </div>
        </Panel>
      )}
      <div className="mt-6 flex justify-between gap-3">
        <Button variant="outline" disabled={step === 1 || busy} onClick={() => setStep(step - 1)}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy || !name.trim()} onClick={() => finish('draft')}>
            Save draft
          </Button>
          {step < 3 && (
            <Button disabled={busy || !name.trim()} onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          )}
        </div>
      </div>
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Choose a template</DialogTitle>
          </DialogHeader>
          {templates.data?.items.map((t) => (
            <button
              key={t.id}
              className="rounded-lg border p-4 text-left hover:bg-indigo-50"
              onClick={() => {
                setSubject(t.subject);
                setHtml(t.body_html);
                setText(t.body_text || '');
                setPicker(false);
              }}
            >
              <p className="font-medium">{t.name}</p>
              <p className="text-sm text-slate-500">{t.subject}</p>
            </button>
          ))}
          <Pagination
            page={templatePage}
            size={25}
            count={templates.data?.count || 0}
            onPage={setTemplatePage}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={confirmSend} onOpenChange={setConfirmSend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this campaign?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            You are about to send this email individually to {selected.length.toLocaleString()}{' '}
            recipients. This action cannot be undone.
          </p>
          <Button disabled={busy} onClick={() => finish('send')}>
            Confirm &amp; send
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={schedule} onOpenChange={setSchedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule campaign</DialogTitle>
          </DialogHeader>
          <Field label="Send at (your local timezone)">
            <input
              className="control"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </Field>
          <Button disabled={busy || !scheduledAt} onClick={() => finish('schedule')}>
            Schedule campaign
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
