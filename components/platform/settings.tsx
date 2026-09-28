'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Sender, Group, List } from '@/lib/models';
import { Heading, Panel, State, Status, Field, api, action, useResource } from './shared';
interface Settings {
  name: string;
  email: string;
  avatar_url: string;
  send_rate: number;
  timezone: string;
  has_provider_key: boolean;
  provider_type: 'gmail_script' | 'resend';
  provider_email: string;
  gmail_relay_url: string;
  webhook_url: string;
}
export function SettingsPage({ sendersOnly = false }: { sendersOnly?: boolean }) {
  const [tab, setTab] = useState(sendersOnly ? 'senders' : 'profile');
  const settings = useResource<Settings>('settings');
  return (
    <>
      <Heading
        title="Settings"
        description="Your profile, sending identities, and workspace preferences."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {['profile', 'senders', 'provider', 'preferences', 'groups', 'billing'].map((t) => (
          <Button key={t} variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>
      <State loading={settings.loading} error={settings.error} retry={settings.reload} />
      {settings.data && ['profile', 'provider', 'preferences'].includes(tab) && (
        <SettingsForm key={tab} tab={tab} value={settings.data} reload={settings.reload} />
      )}{' '}
      {tab === 'senders' && <Senders />}
      {tab === 'groups' && <Groups />}
      {tab === 'billing' && (
        <Panel>
          <h2 className="font-semibold">Billing</h2>
          <p className="mt-2 text-sm text-slate-500">
            Platform billing is not enabled. Email usage is billed by your connected provider.
          </p>
        </Panel>
      )}
    </>
  );
}
function SettingsForm({
  tab,
  value,
  reload,
}: {
  tab: string;
  value: Settings;
  reload: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState(value.provider_type || 'resend');
  return (
    <Panel>
      <form
        className="grid max-w-2xl gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          await action(async () => {
            await api('settings', 'PATCH', {
              send_rate: Number(f.get('send_rate') || value.send_rate),
              timezone: f.get('timezone') || value.timezone,
              ...(tab === 'profile'
                ? { name: f.get('name'), avatar_url: f.get('avatar_url') }
                : {
                    ...(tab === 'provider'
                      ? {
                          provider: f.get('provider'),
                          api_key: f.get('api_key'),
                          gmail_email: f.get('gmail_email'),
                          gmail_relay_url: f.get('gmail_relay_url'),
                          gmail_relay_token: f.get('gmail_relay_token'),
                          webhook_secret: f.get('webhook_secret'),
                        }
                      : {}),
                  }),
            });
            reload();
          });
          setBusy(false);
        }}
      >
        {tab === 'profile' && (
          <>
            <Field label="Name">
              <input className="control" name="name" defaultValue={value.name} />
            </Field>
            <Field label="Account email">
              <input className="control" disabled value={value.email} />
            </Field>
            <Field label="Avatar URL (HTTPS)">
              <input
                className="control"
                type="url"
                name="avatar_url"
                defaultValue={value.avatar_url}
              />
            </Field>
          </>
        )}
        {tab === 'provider' && (
          <>
            <Field label="Email sending service">
              <select
                className="control"
                name="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'gmail_script' | 'resend')}
              >
                <option value="gmail_script">Gmail (Google Apps Script)</option>
                <option value="resend">Resend (requires a verified domain)</option>
              </select>
            </Field>
            {provider === 'gmail_script' ? (
              <>
                <h2 className="font-semibold">Connect Gmail using Google Apps Script</h2>
                <p className="text-sm text-slate-500">
                  Create the Apps Script relay in the Google account that should send the messages.
                  It sends through Gmail over HTTPS, so it works on Railway without a custom domain.
                </p>
                <Field label="Gmail address">
                  <input
                    className="control"
                    type="email"
                    name="gmail_email"
                    defaultValue={value.provider_email}
                    placeholder="you@gmail.com"
                    required
                  />
                </Field>
                <Field label="Google Apps Script Web App URL">
                  <input
                    className="control"
                    type="url"
                    name="gmail_relay_url"
                    defaultValue={
                      value.provider_type === 'gmail_script' ? value.gmail_relay_url : ''
                    }
                    placeholder="https://script.google.com/macros/s/.../exec"
                    required
                  />
                </Field>
                <Field label="Gmail relay secret">
                  <input
                    className="control"
                    type="password"
                    name="gmail_relay_token"
                    autoComplete="new-password"
                    placeholder={
                      value.provider_type === 'gmail_script'
                        ? 'Leave blank to keep current secret'
                        : 'Paste the secret from Apps Script'
                    }
                    required={value.provider_type !== 'gmail_script'}
                  />
                </Field>
                <p className="text-sm text-slate-500">
                  See{' '}
                  <a
                    className="link"
                    href="https://script.google.com/home"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Apps Script
                  </a>
                  . Save the same long secret in the script and here. Gmail enforces its own sending
                  limits.
                </p>
                <p className="text-sm text-slate-500">
                  Gmail limits sending and may block bulk mail. Use this for small, wanted emails.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-semibold">Resend</h2>
                <p className="text-sm text-slate-500">
                  {value.has_provider_key
                    ? 'Your API key is stored encrypted. Leave the field blank to keep it.'
                    : 'Connect your Resend account to send emails.'}
                </p>
                <Field label="Resend API key">
                  <input
                    className="control"
                    type="password"
                    autoComplete="new-password"
                    name="api_key"
                    placeholder="re_…"
                  />
                </Field>
                <Field label="Webhook signing secret">
                  <input
                    className="control"
                    type="password"
                    autoComplete="new-password"
                    name="webhook_secret"
                    placeholder="whsec_…"
                  />
                </Field>
                <p className="text-sm text-slate-500">
                  In Resend, create a webhook for email.delivered, email.bounced, email.complained
                  and email.failed using this endpoint:
                </p>
                <code className="break-all rounded-lg bg-slate-50 p-3 text-xs">
                  {value.webhook_url}
                </code>
                <p className="text-xs text-slate-500">
                  Use a key with sending and domain-read permissions. Provider quotas still apply.
                </p>
              </>
            )}
          </>
        )}
        {tab === 'preferences' && (
          <>
            <Field label="Maximum emails per second (1–10)">
              <input
                className="control"
                type="number"
                min="1"
                max="10"
                name="send_rate"
                defaultValue={value.send_rate}
              />
            </Field>
            <Field label="Timezone">
              <input
                className="control"
                name="timezone"
                defaultValue={value.timezone}
                placeholder="Asia/Kolkata"
              />
            </Field>
            <p className="text-xs text-slate-500">
              Your preference is capped by the server’s provider rate limit.
            </p>
          </>
        )}
        <div>
          <Button disabled={busy}>Save settings</Button>
        </div>
      </form>
    </Panel>
  );
}
function Senders() {
  const r = useResource<List<Sender>>('settings/senders');
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-5">
      <Panel>
        <h2 className="mb-4 font-semibold">Add a sender</h2>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            setBusy(true);
            if (
              await action(async () => {
                await api('settings/senders', 'POST', Object.fromEntries(f));
                r.reload();
              })
            )
              form.reset();
            setBusy(false);
          }}
        >
          <Field label="From name">
            <input className="control" required name="from_name" />
          </Field>
          <Field label="From email">
            <input className="control" required type="email" name="from_email" />
          </Field>
          <Field label="Reply-to">
            <input className="control" type="email" name="reply_to" />
          </Field>
          <Button disabled={busy}>Add sender</Button>
        </form>
        <p className="mt-5 text-sm text-slate-500">
          Add your domain in{' '}
          <a className="link" href="https://resend.com/domains" target="_blank" rel="noreferrer">
            Resend
          </a>
          , copy its SPF and DKIM records into your DNS settings, and wait for verification. Add a
          DMARC policy through your DNS provider. Then click Check verification below.
        </p>
      </Panel>
      <State loading={r.loading} error={r.error} retry={r.reload} />
      {r.data?.items.map((s) => (
        <Panel key={s.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {s.from_name} &lt;{s.from_email}&gt;
              </p>
              <div className="mt-2 flex gap-2">
                <Status value={s.verified ? 'verified' : 'unverified'} />
                {s.is_default && <Status value="default" />}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  action(async () => {
                    await api('settings/senders/' + s.id, 'POST', {});
                    r.reload();
                  }, 'Sender verified')
                }
              >
                Check verification
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  action(async () => {
                    await api('settings/senders/' + s.id, 'PATCH', {});
                    r.reload();
                  })
                }
              >
                Make default
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm('Delete sender? Senders used by campaigns cannot be deleted.'))
                    action(async () => {
                      await api('settings/senders/' + s.id, 'DELETE', {});
                      r.reload();
                    }, 'Sender deleted');
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </Panel>
      ))}
    </div>
  );
}
function Groups() {
  const r = useResource<List<Group>>('contacts/groups');
  return (
    <Panel>
      <h2 className="mb-4 font-semibold">Contact groups</h2>
      <form
        className="mb-6 flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          if (
            await action(async () => {
              await api('contacts/groups', 'POST', Object.fromEntries(f));
              r.reload();
            })
          )
            form.reset();
        }}
      >
        <Field label="Group name">
          <input className="control" required name="name" />
        </Field>
        <Field label="Color">
          <input type="color" className="h-10" name="color" defaultValue="#4f46e5" />
        </Field>
        <Button>Create group</Button>
      </form>
      <State loading={r.loading} error={r.error} retry={r.reload} />
      {r.data?.items.map((g) => (
        <div key={g.id} className="flex items-center justify-between border-b py-3">
          <span className="border-l-4 pl-3 text-sm" style={{ borderColor: g.color }}>
            {g.name}
          </span>
          <Button
            variant="ghost"
            onClick={() => {
              if (confirm('Delete this group? Contacts will be kept.'))
                action(async () => {
                  await api('contacts/groups/' + g.id, 'DELETE', {});
                  r.reload();
                }, 'Group deleted');
            }}
          >
            Delete
          </Button>
        </div>
      ))}
    </Panel>
  );
}
