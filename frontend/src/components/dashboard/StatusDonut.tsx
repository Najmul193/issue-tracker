import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  NEW: '#6366f1',
  ACKNOWLEDGED: '#f59e0b',
  ASSIGNED: '#3b82f6',
  IN_PROGRESS: '#8b5cf6',
  RESOLVED: '#10b981',
  VERIFIED: '#14b8a6',
  CLOSED: '#6b7280',
  REOPENED: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  ACKNOWLEDGED: 'Acknowledged',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  VERIFIED: 'Verified',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
};

interface Props {
  byStatus: Record<string, number>;
}

export default function StatusDonut({ byStatus }: Props) {
  const data = Object.entries(byStatus)
    .filter(([, v]) => v > 0)
    .map(([status, value]) => ({
      name: STATUS_LABELS[status] || status,
      value,
      color: STATUS_COLORS[status] || '#94a3b8',
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [Number(value), String(name)]}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
