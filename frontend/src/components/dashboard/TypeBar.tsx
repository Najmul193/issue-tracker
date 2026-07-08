import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const TYPE_COLORS: Record<string, string> = {
  BUG: '#ef4444',
  NEW_REQUIREMENT: '#3b82f6',
  CHANGE_REQUEST: '#f59e0b',
  QUERY: '#8b5cf6',
};

const TYPE_LABELS: Record<string, string> = {
  BUG: 'Bug',
  NEW_REQUIREMENT: 'New Req.',
  CHANGE_REQUEST: 'Change Req.',
  QUERY: 'Query',
};

interface Props {
  byType: Record<string, number>;
}

export default function TypeBar({ byType }: Props) {
  const data = Object.entries(byType)
    .filter(([, v]) => v > 0)
    .map(([type, value]) => ({
      name: TYPE_LABELS[type] || type,
      value,
      color: TYPE_COLORS[type] || '#94a3b8',
    }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [Number(value), 'Issues']}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
