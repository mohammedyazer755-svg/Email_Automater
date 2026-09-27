'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import type { Campaign, Delivery, List } from '@/lib/models';
import {
  Heading,
  Panel,
  Stats,
  State,
  Pagination,
  Status,
  Preview,
  api,
  action,
  useResource,
  date,
} from './shared';
const Donut = dynamic(
  () => import('@/components/charts/DeliveryCharts').then((m) => m.DeliveryDonut),
  { ssr: false },
);
export function CampaignsPage() {
  const [page, setPage] = useState(1),
    [status, setStatus] = useState(''),
    [search, setSearch] = useState('');
  const resource = useResource<List<Campaign>>(
      `campaigns?page=${page}&status=${status}&search=${encodeURIComponent(search)}`,
    ),
    router = useRouter();
  return (
    <>
      <Heading
        title="Campaigns"
        description="Every message, from the first draft to final delivery."
        href="/campaigns/new"
        label="New campaign"
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {['', 'draft', 'scheduled', 'sending', 'sent', 'failed', 'paused'].map((s) => (
          <Button
            key={s}
            variant={status === s ? 'default' : 'outline'}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {s || 'All'}
          </Button>
        ))}
        <input
          className="control ml-auto"
          aria-label="Search campaigns"
          placeholder="Search campaigns…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <State
        loading={resource.loading}
        error={resource.error}
        retry={resource.reload}
        empty={resource.data?.count === 0}
      />
      {resource.data && !!resource.data.count && (
        <Panel>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Failed</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link className="link" href={'/campaigns/' + c.id}>
                        {c.name}
                      </Link>
                    </td>
                    <td>
                      <Status value={c.status} />
                    </td>
                    <td>{c.total_recipients.toLocaleString()}</td>
                    <td>{c.sent_count.toLocaleString()}</td>
                    <td>{c.failed_count.toLocaleString()}</td>
                    <td>{date(c.created_at)}</td>
                    <td>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            action(async () => {
                              const copy = await api<{ id: string }>(
                                `campaigns/${c.id}/duplicate`,
                                'POST',
                                {},
                              );
                              router.push(`/campaigns/${copy.id}/edit`);
                            }, 'Campaign duplicated')
                          }
                        >
                          Duplicate
                        </Button>
                        {['draft', 'sent', 'failed'].includes(c.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('Delete this campaign and its delivery report?'))
                                action(async () => {
                                  await api('campaigns/' + c.id, 'DELETE', {});
                                  resource.reload();
                                }, 'Campaign deleted');
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} size={25} count={resource.data.count} onPage={setPage} />
        </Panel>
      )}
    </>
  );
}
export function CampaignDetail({ id }: { id: string }) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('');
  const campaign = useResource<Campaign>('campaigns/' + id + '/status', 2000),
    deliveries = useResource<List<Delivery>>(
      `campaigns/${id}/deliveries?page=${page}&search=${encodeURIComponent(search)}&status=${filter}`,
      campaign.data?.status === 'sending' ? 2000 : 0,
    );
  const c = campaign.data,
    stats = c?.stats || {},
    remaining = (stats.queued || 0) + (stats.sending || 0),
    total = Object.values(stats).reduce((n, v) => n + v, 0),
    progress = total ? Math.round(((total - remaining) / total) * 100) : 0;
  return (
    <>
      <Heading
        title={c?.name || 'Campaign report'}
        description={c ? `Created ${date(c.created_at)}` : ''}
      >
        {c && <Status value={c.status} />}{' '}
        {c?.status === 'draft' && (
          <Button asChild>
            <Link href={`/campaigns/${id}/edit`}>Edit draft</Link>
          </Button>
        )}
        {c && ['sending', 'scheduled', 'paused'].includes(c.status) && (
          <Button
            variant="outline"
            onClick={() =>
              action(async () => {
                await api(
                  `campaigns/${id}/${c.status === 'paused' ? 'resume' : 'pause'}`,
                  'POST',
                  {},
                );
                campaign.reload();
              })
            }
          >
            {c.status === 'paused' ? 'Resume' : 'Pause'}
          </Button>
        )}
      </Heading>
      <State loading={campaign.loading && !c} error={campaign.error} retry={campaign.reload} />
      {c && (
        <>
          <Stats
            items={[
              { label: 'Recipients', value: c.total_recipients },
              { label: 'Sent', value: c.sent_count },
              { label: 'Delivered', value: stats.delivered || 0 },
              { label: 'Failed / bounced', value: (stats.failed || 0) + (stats.bounced || 0) },
            ]}
          />
          {['sending', 'paused', 'scheduled'].includes(c.status) && (
            <Panel className="mb-5">
              <div className="mb-3 flex justify-between text-sm">
                <span>
                  {c.status === 'scheduled'
                    ? `Scheduled for ${date(c.scheduled_at)}`
                    : `${total - remaining} of ${total} processed`}
                </span>
                <span>{progress}%</span>
              </div>
              <progress className="h-3 w-full accent-indigo-600" value={progress} max={100} />
              <p className="mt-2 text-xs text-slate-500">
                Queued: {stats.queued || 0} · Sending: {stats.sending || 0} · Suppressed:{' '}
                {stats.skipped || 0}
              </p>
            </Panel>
          )}
          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            <Panel>
              <h2 className="font-semibold">Delivery breakdown</h2>
              <Donut
                data={Object.entries(stats)
                  .filter(([, v]) => v > 0)
                  .map(([status, value]) => ({ status, value }))}
              />
            </Panel>
            <Panel>
              <h2 className="mb-3 font-semibold">{c.subject}</h2>
              <Preview html={c.body_html} />
            </Panel>
          </div>
          <Panel>
            <h2 className="mb-4 font-semibold">Recipient delivery report</h2>
            <div className="mb-4 flex flex-wrap gap-3">
              <input
                aria-label="Search deliveries"
                className="control grow"
                placeholder="Search recipient…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <select
                aria-label="Delivery status"
                className="control"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {Object.keys(stats).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <State error={deliveries.error} retry={deliveries.reload} />
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Delivered</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.data?.items.map((d) => (
                    <tr key={d.id}>
                      <td>{d.recipient_email}</td>
                      <td>
                        <Status value={d.status} />
                      </td>
                      <td>{date(d.sent_at)}</td>
                      <td>{date(d.delivered_at)}</td>
                      <td className="max-w-xs break-words text-xs text-red-600">
                        {d.error_message || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              size={25}
              count={deliveries.data?.count || 0}
              onPage={setPage}
            />
          </Panel>
        </>
      )}
    </>
  );
}
