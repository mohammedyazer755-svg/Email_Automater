'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ImportResult } from '@/lib/spreadsheet/types';
import type { Import, List } from '@/lib/models';
import {
  Heading,
  Panel,
  Stats,
  State,
  Pagination,
  Status,
  api,
  action,
  useResource,
  date,
} from './shared';
export function ImportNew() {
  const [result, setResult] = useState<ImportResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [page, setPage] = useState(1),
    [sort, setSort] = useState('email'),
    [tab, setTab] = useState('valid');
  const router = useRouter(),
    worker = useRef<Worker | null>(null);
  function process(file: File) {
    setError('');
    setBusy(true);
    setResult(null);
    worker.current?.terminate();
    const w = new Worker(new URL('../../lib/spreadsheet/worker.ts', import.meta.url));
    worker.current = w;
    w.onmessage = (event) => {
      setBusy(false);
      w.terminate();
      if (event.data.error) setError(event.data.error);
      else {
        setResult(event.data.result);
        setSelected(new Set());
        setPage(1);
      }
    };
    w.onerror = () => {
      setBusy(false);
      setError('Unable to process this file. Try a smaller workbook.');
      w.terminate();
    };
    w.postMessage(file);
  }
  const rows =
    (tab === 'invalid' ? result?.invalidEntries : result?.recipients)
      ?.filter((r) => r.email.includes(search.toLowerCase()))
      .toSorted((a, b) =>
        sort === 'email' ? a.email.localeCompare(b.email) : a.source.row - b.source.row,
      ) || [];
  const visible = rows.slice((page - 1) * 25, page * 25);
  return (
    <>
      <Heading
        title="Import contacts"
        description="Find every email, in every sheet. Review the results before saving."
      />
      <Panel>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy && e.dataTransfer.files[0]) process(e.dataTransfer.files[0]);
          }}
          className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-10 text-center"
        >
          <UploadCloud className="mx-auto mb-3 h-10 w-10 text-indigo-500" />
          <h2 className="font-semibold">Drop a spreadsheet here</h2>
          <p className="my-2 text-sm text-slate-500">
            CSV, XLS or XLSX · Up to 10 MB · Up to 10,000 recipients per import
          </p>
          <input
            aria-label="Upload spreadsheet"
            type="file"
            accept=".csv,.xlsx,.xls"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.[0]) process(e.target.files[0]);
            }}
          />
        </div>
      </Panel>
      <div className="my-5">
        <State loading={busy} error={error} />
        {busy && (
          <p role="status" className="mt-3 text-sm text-indigo-600">
            Scanning sheets, validating emails, and removing duplicates…
          </p>
        )}
      </div>
      {result && (
        <>
          <Stats
            items={[
              { label: 'Rows scanned', value: result.summary.totalRows },
              { label: 'Emails detected', value: result.summary.totalEmailsDetected },
              { label: 'Valid entries', value: result.summary.validEmails },
              { label: 'Unique recipients', value: result.recipients.length },
              { label: 'Duplicates removed', value: result.summary.duplicatesRemoved },
              { label: 'Invalid entries', value: result.summary.invalidEmails },
              { label: 'Blank cells', value: result.summary.blankCells },
              { label: 'Sheets', value: result.summary.totalSheets },
            ]}
          />
          <Panel>
            <h2 className="font-semibold">Detected email columns</h2>
            <div className="my-4 flex flex-wrap gap-2">
              {result.summary.emailColumns.map((c) => (
                <span
                  key={c.sheet + c.column}
                  className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700"
                >
                  {c.sheet} · {c.column} · {c.confidence.toFixed(0)}%
                </span>
              ))}
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <input
                className="control"
                aria-label="Search recipients"
                placeholder="Search email…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <select
                className="control"
                value={tab}
                onChange={(e) => {
                  setTab(e.target.value);
                  setPage(1);
                }}
                aria-label="Entry status"
              >
                <option value="valid">Valid recipients</option>
                <option value="invalid">Invalid entries</option>
              </select>
              <select
                className="control"
                aria-label="Sort recipients"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="email">Email A–Z</option>
                <option value="row">Source row</option>
              </select>
              <Button
                variant="outline"
                disabled={!selected.size}
                onClick={() => {
                  setResult({
                    ...result,
                    recipients: result.recipients.filter((r) => !selected.has(r.email)),
                  });
                  setSelected(new Set());
                  setPage(1);
                }}
              >
                Remove selected ({selected.size})
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        aria-label="Select page"
                        type="checkbox"
                        disabled={tab !== 'valid'}
                        checked={visible.length > 0 && visible.every((r) => selected.has(r.email))}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            visible.forEach((r) =>
                              e.target.checked ? next.add(r.email) : next.delete(r.email),
                            );
                            return next;
                          })
                        }
                      />
                    </th>
                    <th>Email</th>
                    <th>Sheet</th>
                    <th>Row</th>
                    <th>Column</th>
                    <th>Occurrences</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={r.email + i}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={'Select ' + r.email}
                          disabled={tab !== 'valid'}
                          checked={selected.has(r.email)}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(r.email);
                              else next.delete(r.email);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td>{r.email}</td>
                      <td>{r.source.sheet}</td>
                      <td>{r.source.row}</td>
                      <td>{r.source.column}</td>
                      <td>{r.occurrences || 1}</td>
                      <td>
                        <Status value={tab} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} size={25} count={rows.length} onPage={setPage} />
            <Button
              className="mt-6"
              disabled={busy || !result.recipients.length || result.recipients.length > 10000}
              onClick={async () => {
                setBusy(true);
                await action(async () => {
                  const saved = await api<{ id: string }>('imports', 'POST', result);
                  router.push('/imports/' + saved.id);
                }, 'Recipients imported');
                setBusy(false);
              }}
            >
              Import {result.recipients.length.toLocaleString()} recipients
            </Button>
          </Panel>
        </>
      )}
    </>
  );
}
export function ImportsList() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useResource<List<Import>>(`imports?page=${page}`);
  return (
    <>
      <Heading
        title="Imports"
        description="A clear trail from spreadsheet to recipient."
        href="/imports/new"
        label="Import spreadsheet"
      />
      <State loading={loading} error={error} retry={reload} empty={data?.items.length === 0} />
      {data && data.items.length > 0 && (
        <Panel>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Imported</th>
                  <th>Emails found</th>
                  <th>Duplicates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link className="link" href={'/imports/' + i.id}>
                        <FileSpreadsheet className="mr-2 inline h-4 w-4" />
                        {i.filename}
                      </Link>
                    </td>
                    <td>{date(i.created_at)}</td>
                    <td>{i.total_emails_detected.toLocaleString()}</td>
                    <td>{i.duplicates_removed.toLocaleString()}</td>
                    <td>
                      <Status value={i.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} size={25} count={data.count} onPage={setPage} />
        </Panel>
      )}
    </>
  );
}
export function ImportDetail({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useResource<
    Import & {
      items: {
        contact_id: string;
        contacts: { email: string; status: string };
        source: { sheet: string; row: number; column: string };
      }[];
      count: number;
    }
  >(`imports/${id}?page=${page}`);
  return (
    <>
      <Heading
        title={data?.filename || 'Import report'}
        href="/campaigns/new"
        label="Create campaign"
      />
      <State loading={loading} error={error} retry={reload} />
      {data && (
        <>
          <Stats
            items={[
              { label: 'Rows', value: data.total_rows },
              { label: 'Recipients', value: data.unique_recipients },
              { label: 'Duplicates', value: data.duplicates_removed },
              { label: 'Invalid', value: data.invalid_entries },
            ]}
          />
          <Panel>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Source</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.contact_id}>
                      <td>
                        <Link className="link" href={'/contacts/' + r.contact_id}>
                          {r.contacts.email}
                        </Link>
                      </td>
                      <td>
                        {r.source.sheet} · {r.source.column}
                        {r.source.row}
                      </td>
                      <td>
                        <Status value={r.contacts.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} size={25} count={data.count} onPage={setPage} />
          </Panel>
        </>
      )}
    </>
  );
}
