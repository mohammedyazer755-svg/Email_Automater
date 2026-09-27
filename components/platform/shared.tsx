'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch('/api/' + path, {
    method,
    headers: data instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data),
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({ error: 'Request failed.' }));
    throw new Error(problem.error || 'Request failed.');
  }
  return response.json();
}
export function useResource<T>(path: string | null, interval = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [resolved, setResolved] = useState(''),
    [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const key = path + ':' + version;
  useEffect(() => {
    if (!path) return;
    let active = true;
    const load = () => {
      api<T>(path)
        .then((value) => {
          if (active) {
            setData(value);
            setError('');
            if (
              value &&
              typeof value === 'object' &&
              'status' in value &&
              ['draft', 'sent', 'failed', 'completed'].includes(String(value.status)) &&
              timer
            )
              clearInterval(timer);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setResolved(key);
        });
    };
    load();
    const timer = interval ? setInterval(load, interval) : undefined;
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [path, key, interval]);
  return { data, error, loading: !!path && resolved !== key, reload };
}
export async function action(fn: () => Promise<unknown>, message = 'Saved') {
  try {
    await fn();
    toast.success(message);
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    return false;
  }
}
export function Heading({
  title,
  description,
  href,
  label,
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {children}
        {href && (
          <Button asChild>
            <Link href={href}>{label || 'Create new'}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
export function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ' + className}>
      {children}
    </section>
  );
}
export function State({
  loading,
  error,
  retry,
  empty,
}: {
  loading?: boolean;
  error?: string;
  retry?: () => void;
  empty?: boolean;
}) {
  if (error)
    return (
      <Panel>
        <p role="alert" className="text-red-600">
          {error}
        </p>
        <Button className="mt-3" onClick={retry}>
          Try again
        </Button>
      </Panel>
    );
  if (loading)
    return <div aria-label="Loading" className="h-40 animate-pulse rounded-2xl bg-slate-200/60" />;
  if (empty)
    return (
      <Panel>
        <p className="py-8 text-center text-slate-500">
          Nothing here yet. Create your first record to get started.
        </p>
      </Panel>
    );
  return null;
}
export function Status({ value }: { value: string }) {
  return (
    <Badge
      variant="outline"
      className={
        ['active', 'valid', 'sent', 'delivered', 'completed', 'verified'].includes(value)
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : ['failed', 'invalid', 'bounced', 'complained'].includes(value)
            ? 'border-red-200 bg-red-50 text-red-700'
            : ['sending', 'queued', 'scheduled'].includes(value)
              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
              : 'bg-slate-50 text-slate-500'
      }
    >
      {value}
    </Badge>
  );
}
export function Stats({ items }: { items: { label: string; value: number | string }[] }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
      {items.map((i) => (
        <Panel key={i.label}>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{i.label}</p>
          <p
            className={
              'mt-3 text-3xl font-semibold ' +
              (/invalid|failed|bounced/i.test(i.label)
                ? 'text-red-600'
                : /duplicate/i.test(i.label)
                  ? 'text-amber-600'
                  : /valid|unique|delivered/i.test(i.label)
                    ? 'text-emerald-600'
                    : 'text-indigo-700')
            }
          >
            {typeof i.value === 'number' ? i.value.toLocaleString() : i.value}
          </p>
        </Panel>
      ))}
    </div>
  );
}
export function Pagination({
  page,
  size,
  count,
  onPage,
  onSize,
}: {
  page: number;
  size: number;
  count: number;
  onPage: (p: number) => void;
  onSize?: (s: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
      <span>
        {count.toLocaleString()} results · Page {page} of {Math.max(1, Math.ceil(count / size))}
      </span>
      <div className="flex items-center gap-2">
        {onSize && (
          <select
            aria-label="Rows per page"
            className="control"
            value={size}
            onChange={(e) => onSize(Number(e.target.value))}
          >
            {[25, 50, 100].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        )}
        <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" disabled={page * size >= count} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}
export function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '—';
}
export function Preview({ html }: { html: string }) {
  return (
    <iframe
      title="Email preview"
      sandbox=""
      referrerPolicy="no-referrer"
      className="h-80 w-full rounded-xl border bg-white"
      srcDoc={
        '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src https: data:; style-src \'unsafe-inline\'"><style>body{font:16px/1.7 Arial,sans-serif;padding:24px;color:#1e293b;overflow-wrap:anywhere}img{max-width:100%}</style></head><body>' +
        html +
        '</body></html>'
      }
    />
  );
}
