import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { TrendPoint } from '../../api/dashboard';

interface Props {
  data: TrendPoint[];
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function TrendLine({ data }: Props) {
  const chartData = data.map((d) => ({ ...d, label: shortDate(d.date) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
          interval={4}
        />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="created"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          name="Created"
        />
        <Line
          type="monotone"
          dataKey="resolved"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          name="Resolved"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
