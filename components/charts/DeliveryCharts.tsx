'use client';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
const colors = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#94a3b8',
  '#06b6d4',
  '#f97316',
];
export function DeliveryDonut({ data }: { data: { status: string; value: number }[] }) {
  return (
    <div
      className="h-64"
      role="img"
      aria-label={data.map((d) => `${d.status}: ${d.value}`).join(', ')}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="status"
            innerRadius={60}
            outerRadius={88}
            paddingAngle={3}
          >
            {data.map((d, i) => (
              <Cell key={d.status} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
export default function DeliveryCharts({
  timeline,
  campaigns,
}: {
  timeline: { date: string; sent: number }[];
  campaigns: { name: string; sent_count: number; failed_count: number }[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div>
        <h3 className="mb-4 text-sm font-medium">Emails sent over time (UTC)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="sent" stroke="#6366f1" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <h3 className="mb-4 text-sm font-medium">Campaign performance</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={campaigns}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sent_count" name="Sent" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed_count" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
