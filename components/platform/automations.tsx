'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Clock, GitBranch, ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Automation, Step, Enrollment, Sender, Template, Group, List } from '@/lib/models';
import { RecipientPicker } from './contacts';
import {
  Heading,
  Panel,
  State,
  Stats,
  Pagination,
  Status,
  Field,
  api,
  action,
  useResource,
  date,
} from './shared';
export function AutomationsPage() {
  const [page, setPage] = useState(1);
  const r = useResource<List<Automation>>('automations?page=' + page);
  return (
    <>
      <Heading
        title="Automations"
        description="Thoughtful follow-ups that run on your schedule."
        href="/automations/new"
        label="New workflow"
      />
      <State loading={r.loading} error={r.error} retry={r.reload} empty={r.data?.count === 0} />
      {r.data && (
        <Panel>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Trigger</th>
                  <th>Steps</th>
                  <th>Enrolled</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {r.data.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link className="link" href={'/automations/' + a.id}>
                        {a.name}
                      </Link>
                    </td>
                    <td>{a.trigger_type.replaceAll('_', ' ')}</td>
                    <td>{a.automation_steps?.[0]?.count || 0}</td>
                    <td>{a.automation_enrollments?.[0]?.count || 0}</td>
                    <td>
                      <Status value={a.status} />
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            action(async () => {
                              await api(
                                `automations/${a.id}/${a.status === 'active' ? 'pause' : 'activate'}`,
                                'POST',
                                {},
                              );
                              r.reload();
                            })
                          }
                        >
                          {a.status === 'active' ? 'Pause' : 'Activate'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={a.status === 'active'}
                          onClick={() => {
                            if (confirm('Delete this workflow and its enrollments?'))
                              action(async () => {
                                await api('automations/' + a.id, 'DELETE', {});
                                r.reload();
                              }, 'Workflow deleted');
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} size={25} count={r.data.count} onPage={setPage} />
        </Panel>
      )}
    </>
  );
}
export function AutomationEditor({ id }: { id?: string }) {
  const r = useResource<Automation>(id ? 'automations/' + id : null);
  if (id && !r.data) return <State loading={r.loading} error={r.error} retry={r.reload} />;
  return <AutomationForm initial={r.data} />;
}
function AutomationForm({ initial }: { initial: Automation | null }) {
  const [name, setName] = useState(initial?.name || ''),
    [description, setDescription] = useState(initial?.description || ''),
    [trigger, setTrigger] = useState(initial?.trigger_type || 'manual'),
    [group, setGroup] = useState(initial?.trigger_config.group_id || ''),
    [cron, setCron] = useState(initial?.trigger_config.schedule_cron || '0 9 * * *'),
    [timezone, setTimezone] = useState(initial?.trigger_config.timezone || 'UTC'),
    [sender, setSender] = useState(initial?.sender_id || ''),
    [steps, setSteps] = useState<Step[]>(initial?.steps || []),
    [busy, setBusy] = useState(false);
  const templates = useResource<List<Template>>('templates?size=100'),
    senders = useResource<List<Sender>>('settings/senders'),
    groups = useResource<List<Group>>('contacts/groups'),
    router = useRouter();
  function update(index: number, config: Step['config']) {
    setSteps(steps.map((s, i) => (i === index ? { ...s, config: { ...s.config, ...config } } : s)));
  }
  function move(i: number, to: number) {
    const next = [...steps];
    [next[i], next[to]] = [next[to], next[i]];
    setSteps(next);
  }
  async function save(activate = false) {
    setBusy(true);
    await action(
      async () => {
        const r = await api<{ id: string }>(
          initial ? 'automations/' + initial.id : 'automations',
          initial ? 'PATCH' : 'POST',
          {
            name,
            description,
            trigger_type: trigger,
            trigger_config: {
              ...(group ? { group_id: group } : {}),
              schedule_cron: cron,
              timezone,
            },
            sender_id: sender,
            steps,
          },
        );
        if (activate) await api(`automations/${r.id}/activate`, 'POST', {});
        router.push('/automations/' + r.id);
      },
      activate ? 'Workflow activated' : 'Workflow saved',
    );
    setBusy(false);
  }
  return (
    <>
      <Heading
        title={initial ? 'Edit workflow' : 'Create a workflow'}
        description="Build a sequence of emails, delays, and conditions."
      />
      <Panel>
        <div className="grid gap-5">
          <Field label="Workflow name">
            <input className="control" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea
              className="control"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Trigger">
              <select
                className="control"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
              >
                <option value="manual">Manual enrollment</option>
                <option value="contact_imported">When contacts are imported</option>
                <option value="scheduled">On a schedule</option>
              </select>
            </Field>
            <Field label="Sender">
              <select
                className="control"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
              >
                <option value="">Choose sender…</option>
                {senders.data?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.from_email}
                  </option>
                ))}
              </select>
            </Field>
            {trigger !== 'manual' && (
              <Field label="Limit enrollment to a group">
                <select
                  className="control"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                >
                  <option value="">All contacts</option>
                  {groups.data?.items.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {trigger === 'scheduled' && (
              <>
                <Field label="Cron schedule (minute hour day month weekday)">
                  <input
                    title="Example: 0 9 * * * runs daily at 09:00"
                    className="control"
                    value={cron}
                    onChange={(e) => setCron(e.target.value)}
                  />
                </Field>
                <Field label="Timezone">
                  <input
                    className="control"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  />
                </Field>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Each contact enrolls once per workflow. Scheduled runs enroll new eligible contacts.
            Inactive contacts exit before the next step.
          </p>
        </div>
      </Panel>
      <div className="my-6 space-y-4 border-l-2 border-indigo-100 pl-6">
        {steps.map((s, i) => {
          const Icon =
            s.step_type === 'send_email' ? Mail : s.step_type === 'wait' ? Clock : GitBranch;
          return (
            <Panel key={i}>
              <div className="mb-4 flex items-center gap-3">
                <Icon className="h-5 w-5 text-indigo-600" />
                <h2 className="flex-1 font-medium">
                  {i + 1}. {s.step_type.replace('_', ' ')}
                </h2>
                <Button
                  aria-label="Move step up"
                  variant="ghost"
                  size="icon"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  aria-label="Move step down"
                  variant="ghost"
                  size="icon"
                  disabled={i === steps.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  aria-label="Delete step"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm('Remove this step?')) setSteps(steps.filter((_, n) => n !== i));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {s.step_type === 'send_email' ? (
                <div className="grid gap-3">
                  <Field label="Template">
                    <select
                      className="control"
                      value={s.config.template_id || ''}
                      onChange={(e) => update(i, { template_id: e.target.value })}
                    >
                      <option value="">Choose template…</option>
                      {templates.data?.items.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Subject override (optional)">
                    <input
                      className="control"
                      value={s.config.subject_override || ''}
                      onChange={(e) => update(i, { subject_override: e.target.value })}
                    />
                  </Field>
                </div>
              ) : s.step_type === 'wait' ? (
                <Field label="Wait duration in hours">
                  <input
                    type="number"
                    min="0.001"
                    max="8760"
                    step="any"
                    className="control"
                    value={s.config.duration_hours || 1}
                    onChange={(e) => update(i, { duration_hours: Number(e.target.value) })}
                  />
                </Field>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <span className="py-2 text-sm">Continue if contact status</span>
                  <select
                    className="control"
                    aria-label="Condition operator"
                    value={s.config.operator || 'equals'}
                    onChange={(e) => update(i, { operator: e.target.value })}
                  >
                    <option value="equals">equals</option>
                    <option value="not_equals">does not equal</option>
                  </select>
                  <select
                    className="control"
                    aria-label="Condition status"
                    value={s.config.status || 'active'}
                    onChange={(e) => update(i, { status: e.target.value })}
                  >
                    {['active', 'unsubscribed', 'bounced'].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
              )}
            </Panel>
          );
        })}
        <div className="flex flex-wrap gap-3">
          {(['send_email', 'wait', 'condition'] as const).map((type) => (
            <Button
              variant="outline"
              key={type}
              onClick={() =>
                setSteps([
                  ...steps,
                  {
                    step_type: type,
                    config:
                      type === 'wait'
                        ? { duration_hours: 24 }
                        : type === 'condition'
                          ? { status: 'active', operator: 'equals' }
                          : {},
                  },
                ])
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {type.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" disabled={busy} onClick={() => save()}>
          Save as draft
        </Button>
        <Button disabled={busy} onClick={() => save(true)}>
          Activate workflow
        </Button>
      </div>
    </>
  );
}
export function AutomationDetail({ id }: { id: string }) {
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [enrolling, setEnrolling] = useState(false);
  const r = useResource<Automation>('automations/' + id),
    enrollments = useResource<List<Enrollment> & { stats: Record<string, number> }>(
      `automations/${id}/enrollments?page=${page}`,
      10000,
    );
  return (
    <>
      <Heading title={r.data?.name || 'Workflow'} description={r.data?.description}>
        {r.data && <Status value={r.data.status} />}{' '}
        {r.data?.status === 'draft' && (
          <Button asChild variant="outline">
            <Link href={`/automations/${id}/edit`}>Edit draft</Link>
          </Button>
        )}
        <Button variant="outline" onClick={() => setEnrolling(!enrolling)}>
          Enroll contacts
        </Button>
        {r.data && (
          <Button
            onClick={() =>
              action(async () => {
                await api(
                  `automations/${id}/${r.data!.status === 'active' ? 'pause' : 'activate'}`,
                  'POST',
                  {},
                );
                r.reload();
              })
            }
          >
            {r.data.status === 'active' ? 'Pause' : 'Activate'}
          </Button>
        )}
      </Heading>
      <State loading={r.loading} error={r.error} retry={r.reload} />
      {enrolling && (
        <Panel className="mb-6">
          <RecipientPicker selected={selected} onChange={setSelected} />
          <Button
            className="mt-4"
            disabled={!selected.length || r.data?.status !== 'active'}
            onClick={() =>
              action(async () => {
                await api(`automations/${id}/enroll`, 'POST', { ids: selected });
                setEnrolling(false);
                setSelected([]);
                enrollments.reload();
              }, 'Contacts enrolled')
            }
          >
            Enroll {selected.length} contacts
          </Button>
        </Panel>
      )}
      <div className="mb-6 space-y-3 border-l-2 border-indigo-100 pl-5">
        {r.data?.steps.map((s, i) => (
          <Panel key={i}>
            <p className="font-medium">
              {i + 1}. {s.step_type.replace('_', ' ')}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {s.step_type === 'wait'
                ? `Wait ${s.config.duration_hours} hours`
                : s.step_type === 'condition'
                  ? `Continue when status ${s.config.operator} ${s.config.status}`
                  : s.config.subject_override || 'Send selected template'}
            </p>
          </Panel>
        ))}
      </div>
      <Panel>
        <h2 className="mb-4 font-semibold">Enrollments</h2>
        {enrollments.data?.stats && (
          <Stats
            items={Object.entries(enrollments.data.stats).map(([label, value]) => ({
              label,
              value,
            }))}
          />
        )}
        <State error={enrollments.error} retry={enrollments.reload} />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Next step</th>
                <th>Status</th>
                <th>Next action</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.data?.items.map((e) => (
                <tr key={e.id}>
                  <td>{e.contacts.email}</td>
                  <td>{e.step_index + 1}</td>
                  <td>
                    <Status value={e.status} />
                  </td>
                  <td>{date(e.next_action_at)}</td>
                  <td className="text-xs text-red-600">{e.error_message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} size={25} count={enrollments.data?.count || 0} onPage={setPage} />
      </Panel>
    </>
  );
}
