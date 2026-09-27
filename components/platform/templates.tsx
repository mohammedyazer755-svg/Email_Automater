'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import type { Template, List } from '@/lib/models';
import {
  Heading,
  Panel,
  State,
  Pagination,
  Field,
  Preview,
  api,
  action,
  useResource,
  date,
} from './shared';
const EmailEditor = dynamic(() => import('@/components/email/EmailEditor'), { ssr: false });
export const categories = [
  'confirmation',
  'reminder',
  'announcement',
  'update',
  'certificate',
  'custom',
];
export function TemplatesPage() {
  const [search, setSearch] = useState(''),
    [category, setCategory] = useState(''),
    [page, setPage] = useState(1);
  const resource = useResource<List<Template>>(
    `templates?page=${page}&search=${encodeURIComponent(search)}&category=${category}`,
  );
  return (
    <>
      <Heading
        title="Template library"
        description="Thoughtful emails, ready to make your own."
        href="/templates/new"
        label="Create template"
      >
        <Button
          variant="outline"
          onClick={() =>
            action(async () => {
              await api('templates/seed', 'POST', {});
              resource.reload();
            }, 'Starter templates added')
          }
        >
          Add starter templates
        </Button>
      </Heading>
      <div className="mb-5 flex gap-3">
        <input
          aria-label="Search templates"
          className="control grow"
          placeholder="Search templates…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="control"
          aria-label="Template category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <State
        loading={resource.loading}
        error={resource.error}
        retry={resource.reload}
        empty={resource.data?.count === 0}
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {resource.data?.items.map((t) => (
          <Panel key={t.id}>
            <div className="pointer-events-none h-40 overflow-hidden rounded-lg bg-slate-50">
              <Preview html={t.body_html} />
            </div>
            <div className="mt-4 flex items-start justify-between gap-2">
              <h2 className="font-semibold">{t.name}</h2>
              <span className="text-xs text-indigo-600">{t.category}</span>
            </div>
            <p className="my-2 text-sm text-slate-500">{t.subject}</p>
            <p className="mb-4 text-xs text-slate-400">Updated {date(t.updated_at)}</p>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href={'/templates/' + t.id + '/edit'}>Edit</Link>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (
                    confirm('Delete this template? Workflows using it will need another template.')
                  )
                    action(async () => {
                      await api('templates/' + t.id, 'DELETE', {});
                      resource.reload();
                    }, 'Template deleted');
                }}
              >
                Delete
              </Button>
            </div>
          </Panel>
        ))}
      </div>
      <Pagination page={page} size={25} count={resource.data?.count || 0} onPage={setPage} />
    </>
  );
}
export function TemplateEditor({ id }: { id?: string }) {
  const resource = useResource<Template>(id ? 'templates/' + id : null);
  if (id && !resource.data)
    return <State loading={resource.loading} error={resource.error} retry={resource.reload} />;
  return <TemplateForm key={id} initial={resource.data} id={id} />;
}
function TemplateForm({ initial, id }: { initial: Template | null; id?: string }) {
  const [name, setName] = useState(initial?.name || ''),
    [category, setCategory] = useState(initial?.category || 'custom'),
    [subject, setSubject] = useState(initial?.subject || ''),
    [html, setHtml] = useState(initial?.body_html || ''),
    [text, setText] = useState(initial?.body_text || ''),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <>
      <Heading
        title={id ? 'Edit template' : 'Create template'}
        description="Keep the structure. Make each message your own."
      />
      <Panel>
        <form
          className="grid gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await action(async () => {
              await api(id ? 'templates/' + id : 'templates', id ? 'PATCH' : 'POST', {
                name,
                category,
                subject,
                body_html: html,
                body_text: text,
              });
              router.push('/templates');
            }, 'Template saved');
            setBusy(false);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Template name">
              <input
                required
                className="control"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Category">
              <select
                className="control"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Subject">
            <input
              className="control"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Field>
          <EmailEditor
            value={html}
            onChange={(h, t) => {
              setHtml(h);
              setText(t);
            }}
          />
          <div>
            <Button disabled={busy}>Save template</Button>
          </div>
        </form>
      </Panel>
    </>
  );
}
