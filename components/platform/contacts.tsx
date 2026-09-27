'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Contact, Group, List, Delivery, Import } from '@/lib/models';
import {
  Heading,
  Panel,
  State,
  Pagination,
  Status,
  Field,
  api,
  action,
  useResource,
  date,
} from './shared';
export function ContactsPage() {
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState(''),
    [sort, setSort] = useState('newest'),
    [group, setGroup] = useState(''),
    [page, setPage] = useState(1),
    [size, setSize] = useState(25),
    [selected, setSelected] = useState<string[]>([]),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const resource = useResource<List<Contact>>(
      `contacts?page=${page}&size=${size}&search=${encodeURIComponent(search)}&status=${filter}&sort=${sort}&group=${group}`,
    ),
    groups = useResource<List<Group>>('contacts/groups');
  const refresh = () => {
    resource.reload();
    setSelected([]);
    window.dispatchEvent(new Event('contacts-changed'));
  };
  async function bulk(method: string, data: unknown) {
    setBusy(true);
    await action(async () => {
      await api('contacts', method, data);
      refresh();
    });
    setBusy(false);
  }
  async function exportContacts() {
    await action(async () => {
      const res = await fetch('/api/contacts/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected }),
      });
      if (!res.ok) throw new Error('Export failed.');
      const url = URL.createObjectURL(await res.blob()),
        a = document.createElement('a');
      a.href = url;
      a.download = 'contacts.csv';
      a.click();
      URL.revokeObjectURL(url);
    }, 'Export downloaded');
  }
  return (
    <>
      <Heading
        title="Contacts"
        description="Manage recipients, groups, and delivery preferences."
        href="/imports/new"
        label="Import contacts"
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Add contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a contact</DialogTitle>
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const f = new FormData(e.currentTarget);
                if (
                  await action(async () => {
                    await api('contacts', 'POST', {
                      email: f.get('email'),
                      name: f.get('name'),
                      ...(f.get('group') ? { group_id: f.get('group') } : {}),
                    });
                    refresh();
                  })
                )
                  setOpen(false);
                setBusy(false);
              }}
            >
              <Field label="Email">
                <input className="control" required type="email" name="email" />
              </Field>
              <Field label="Name">
                <input className="control" name="name" />
              </Field>
              <Field label="Group">
                <select className="control" name="group">
                  <option value="">No group</option>
                  {groups.data?.items.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Button disabled={busy}>Add contact</Button>
            </form>
          </DialogContent>
        </Dialog>
      </Heading>
      <Panel>
        <div className="mb-5 flex flex-wrap gap-3">
          <input
            aria-label="Search contacts"
            className="control grow"
            placeholder="Search by email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              setSelected([]);
            }}
          />
          <select
            aria-label="Filter status"
            className="control"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
              setSelected([]);
            }}
          >
            <option value="">All statuses</option>
            {['active', 'unsubscribed', 'bounced'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            className="control"
            aria-label="Filter group"
            value={group}
            onChange={(e) => {
              setGroup(e.target.value);
              setPage(1);
              setSelected([]);
            }}
          >
            <option value="">All groups</option>
            {groups.data?.items.map((g) => (
              <option value={g.id} key={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort contacts"
            className="control"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="email">Email A–Z</option>
          </select>
        </div>
        {selected.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-indigo-50 p-3">
            <span className="text-sm">{selected.length} selected</span>
            <Button disabled={busy} variant="outline" onClick={exportContacts}>
              Export
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => {
                if (
                  confirm(`Delete ${selected.length} contacts? Their delivery records will remain.`)
                )
                  bulk('DELETE', { ids: selected });
              }}
            >
              Delete
            </Button>
            <select
              className="control"
              aria-label="Bulk status"
              value=""
              disabled={busy}
              onChange={(e) => {
                if (confirm('Change the selected contacts’ status?'))
                  bulk('PATCH', { ids: selected, status: e.target.value });
              }}
            >
              <option value="">Change status…</option>
              {['active', 'unsubscribed', 'bounced'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              className="control"
              aria-label="Add to group"
              value=""
              onChange={(e) =>
                action(async () => {
                  await api(`contacts/groups/${e.target.value}/members`, 'POST', { ids: selected });
                  refresh();
                })
              }
            >
              <option value="">Add to group…</option>
              {groups.data?.items.map((g) => (
                <option value={g.id} key={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <State
          loading={resource.loading}
          error={resource.error}
          retry={resource.reload}
          empty={resource.data?.count === 0}
        />
        {resource.data && (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Select page"
                        checked={
                          !!resource.data.items.length &&
                          resource.data.items.every((c) => selected.includes(c.id))
                        }
                        onChange={(e) =>
                          setSelected(e.target.checked ? resource.data!.items.map((c) => c.id) : [])
                        }
                      />
                    </th>
                    <th>Email / Name</th>
                    <th>Source</th>
                    <th>Groups</th>
                    <th>Status</th>
                    <th>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.items.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={'Select ' + c.email}
                          checked={selected.includes(c.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, c.id]
                                : selected.filter((id) => id !== c.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <Link className="link" href={'/contacts/' + c.id}>
                          {c.email}
                        </Link>
                        <p className="text-xs text-slate-500">{c.name}</p>
                      </td>
                      <td>
                        {c.source_import_id ? (
                          <Link href={'/imports/' + c.source_import_id}>
                            {c.imports?.filename || 'Import'}
                          </Link>
                        ) : (
                          'Manual'
                        )}
                      </td>
                      <td>
                        {c.contact_group_members?.map((m) => (
                          <span
                            key={m.group_id}
                            className="mr-1 rounded-full border px-2 py-1 text-xs"
                            style={{ borderColor: m.contact_groups.color }}
                          >
                            {m.contact_groups.name}
                          </span>
                        ))}
                      </td>
                      <td>
                        <Status value={c.status} />
                      </td>
                      <td>{date(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              size={size}
              count={resource.data.count}
              onPage={(p) => {
                setPage(p);
                setSelected([]);
              }}
              onSize={(s) => {
                setSize(s);
                setPage(1);
                setSelected([]);
              }}
            />
          </>
        )}
      </Panel>
    </>
  );
}
export function ContactDetail({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useResource<
    Contact & { imports: { imports: Import }[]; deliveries: Delivery[] }
  >(`contacts/${id}?page=${page}`);
  return (
    <>
      <Heading title={data?.email || 'Contact details'} />
      <State loading={loading} error={error} retry={reload} />
      {data && (
        <div className="grid gap-5">
          <Panel>
            <form
              className="flex flex-wrap items-end gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                action(async () => {
                  await api('contacts/' + id, 'PATCH', {
                    name: f.get('name'),
                    status: f.get('status'),
                  });
                  reload();
                });
              }}
            >
              <Field label="Name">
                <input name="name" className="control" defaultValue={data.name} />
              </Field>
              <Field label="Status">
                <select className="control" name="status" defaultValue={data.status}>
                  {['active', 'unsubscribed', 'bounced'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Button>Save changes</Button>
            </form>
          </Panel>
          <Panel>
            <h2 className="mb-4 font-semibold">Import history</h2>
            {data.imports.map((r) => (
              <p key={r.imports.id} className="border-b py-3">
                <Link className="link" href={'/imports/' + r.imports.id}>
                  {r.imports.filename}
                </Link>
                <span className="ml-4 text-xs text-slate-500">{date(r.imports.created_at)}</span>
              </p>
            ))}
            {!data.imports.length && (
              <p className="text-sm text-slate-500">No imports on this page.</p>
            )}
          </Panel>
          <Panel>
            <h2 className="mb-4 font-semibold">Campaign activity</h2>
            {data.deliveries.map((d) => (
              <div className="flex flex-wrap justify-between gap-3 border-b py-3" key={d.id}>
                <span>{d.campaigns?.name}</span>
                <Status value={d.status} />
                <span className="text-xs text-slate-500">{date(d.sent_at || d.created_at)}</span>
                {d.error_message && (
                  <p className="w-full text-sm text-red-600">{d.error_message}</p>
                )}
              </div>
            ))}
            {!data.deliveries.length && (
              <p className="text-sm text-slate-500">No campaign activity on this page.</p>
            )}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={data.deliveries.length < 25 && data.imports.length < 25}
                onClick={() => setPage(page + 1)}
              >
                Next history page
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
export function RecipientPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [source, setSource] = useState('all'),
    [sourceId, setSourceId] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false);
  const groups = useResource<List<Group>>('contacts/groups'),
    imports = useResource<List<Import>>('imports?size=100');
  const suffix =
    source === 'group' && sourceId
      ? `&group=${sourceId}`
      : source === 'import' && sourceId
        ? `&import=${sourceId}`
        : '';
  const contacts = useResource<List<Contact>>(
    `contacts?status=active&page=${page}&search=${encodeURIComponent(search)}${suffix}`,
  );
  async function selectAll(append = false) {
    setBusy(true);
    await action(async () => {
      const result: string[] = [];
      for (let p = 1; p <= 100; p++) {
        const r = await api<List<Contact>>(`contacts?status=active&size=100&page=${p}${suffix}`);
        if (r.count > 10000)
          throw new Error('Select a group or import with at most 10,000 recipients.');
        result.push(...r.items.map((c) => c.id));
        if (p * 100 >= r.count) break;
      }
      const next = [...new Set(append ? [...selected, ...result] : result)];
      if (next.length > 10000) throw new Error('A campaign supports at most 10,000 recipients.');
      onChange(next);
    }, 'Recipients selected');
    setBusy(false);
  }
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Recipient source"
          className="control"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setSourceId('');
            setPage(1);
          }}
        >
          <option value="all">All active contacts</option>
          <option value="import">From an import</option>
          <option value="group">From a group</option>
          <option value="manual">Manual selection</option>
        </select>
        {['group', 'import'].includes(source) && (
          <select
            className="control"
            aria-label="Select source"
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Choose…</option>
            {source === 'group'
              ? groups.data?.items.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))
              : imports.data?.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.filename}
                  </option>
                ))}
          </select>
        )}
        <Button
          variant="outline"
          disabled={busy || (['group', 'import'].includes(source) && !sourceId)}
          onClick={() => selectAll()}
        >
          Select all in source
        </Button>
        {selected.length > 0 && (
          <Button
            variant="outline"
            disabled={busy || (['group', 'import'].includes(source) && !sourceId)}
            onClick={() => selectAll(true)}
          >
            Add source to selection
          </Button>
        )}
        <Button variant="ghost" onClick={() => onChange([])}>
          Clear selection
        </Button>
      </div>
      <p className="text-2xl font-semibold text-indigo-700">
        {selected.length.toLocaleString()} recipients selected
      </p>
      <input
        className="control"
        aria-label="Search available contacts"
        placeholder="Search contacts…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <State loading={contacts.loading} error={contacts.error} retry={contacts.reload} />
      <div className="max-h-72 overflow-auto divide-y">
        {contacts.data?.items.map((c) => (
          <label className="flex items-center gap-3 py-3 text-sm" key={c.id}>
            <input
              type="checkbox"
              checked={selected.includes(c.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked ? [...selected, c.id] : selected.filter((id) => id !== c.id),
                )
              }
            />
            {c.email}
          </label>
        ))}
      </div>
      <Pagination page={page} size={25} count={contacts.data?.count || 0} onPage={setPage} />
    </div>
  );
}
