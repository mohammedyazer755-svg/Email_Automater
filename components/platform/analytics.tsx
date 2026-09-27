'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Campaign } from '@/lib/models';
import { Heading, Panel, Stats, State, Status, useResource, date } from './shared';
const Charts = dynamic(() => import('@/components/charts/DeliveryCharts'), { ssr: false });
const Donut = dynamic(
  () => import('@/components/charts/DeliveryCharts').then((m) => m.DeliveryDonut),
  { ssr: false },
);
interface Report {
  contacts: number;
  campaigns: number;
  sent: number;
  delivered: number;
  failed: number;
  success_rate: number;
  timeline: { date: string; sent: number }[];
  statuses: { status: string; value: number }[];
  top: Campaign[];
  recent: Campaign[];
  activity: { id: string; title: string; type: string; created_at: string }[];
}
export function Analytics({ dashboard = false }: { dashboard?: boolean }) {
  const [days, setDays] = useState(dashboard ? '0' : '30');
  const { data, loading, error, reload } = useResource<Report>('analytics/overview?days=' + days);
  const profile = useResource<{ name: string }>(dashboard ? 'settings' : null);
  return (
    <>
      <Heading
        title={
          dashboard ? `Welcome${profile.data?.name ? ', ' + profile.data.name : ''}` : 'Analytics'
        }
        description={
          dashboard
            ? 'Your email activity at a glance.'
            : 'Understand delivery performance across your campaigns.'
        }
        href="/campaigns/new"
        label="New campaign"
      >
        {dashboard ? (
          <Link className="control" href="/imports/new">
            Import contacts
          </Link>
        ) : (
          <select
            className="control"
            aria-label="Analytics date range"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="0">All time</option>
          </select>
        )}
      </Heading>
      <State loading={loading} error={error} retry={reload} />
      {data && (
        <>
          <Stats
            items={[
              { label: 'Total contacts', value: data.contacts },
              { label: 'Campaigns', value: data.campaigns },
              { label: 'Emails sent', value: data.sent },
              { label: 'Acceptance success', value: data.success_rate + '%' },
            ]}
          />
          <p className="mb-5 text-xs text-slate-500">
            Success counts accepted or delivered messages among finished attempts. Delivery
            confirmation depends on provider webhooks.
          </p>
          {!dashboard && (
            <Panel className="mb-5">
              <Charts timeline={data.timeline} campaigns={data.top} />
            </Panel>
          )}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <h2 className="mb-4 font-semibold">
                {dashboard ? 'Recent campaigns' : 'Top campaigns by recipients'}
              </h2>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Recipients</th>
                      <th>Sent</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboard ? data.recent : data.top).map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link className="link" href={'/campaigns/' + c.id}>
                            {c.name}
                          </Link>
                        </td>
                        <td>{c.total_recipients.toLocaleString()}</td>
                        <td>{c.sent_count.toLocaleString()}</td>
                        <td>
                          <Status value={c.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.campaigns && (
                <p className="py-6 text-sm text-slate-500">
                  Create your first campaign to see its progress here.
                </p>
              )}
            </Panel>
            <Panel>
              <h2 className="mb-4 font-semibold">
                {dashboard ? 'Recent activity' : 'Delivery status'}
              </h2>
              {dashboard ? (
                <div className="divide-y">
                  {data.activity.map((a) => (
                    <div key={a.id} className="py-3">
                      <Link
                        className="text-sm font-medium text-slate-700 hover:text-indigo-600"
                        href={`/${a.type === 'import' ? 'imports' : 'campaigns'}/${a.id}`}
                      >
                        {a.type === 'import' ? 'Imported' : 'Campaign'}: {a.title}
                      </Link>
                      <p className="mt-1 text-xs text-slate-400">{date(a.created_at)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <Donut data={data.statuses} />
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
