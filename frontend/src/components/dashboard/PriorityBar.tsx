import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Match PriorityBadge colors exactly
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

const ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

interface Props {
  byPriority: Record<string, number>;
}

export default function PriorityBar({ byPriority }: Props) {
  const data = ORDER
    .filter((p) => byPriority[p] !== undefined)
    .map((priority) => ({
      name: priority.charAt(0) + priority.slice(1).toLowerCase(),
      value: byPriority[priority] || 0,
      color: PRIORITY_COLORS[priority],
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          formatter={(value) => [Number(value), 'Issues']}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
