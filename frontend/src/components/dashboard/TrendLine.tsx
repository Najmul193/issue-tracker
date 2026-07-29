import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { TrendPoint } from '../../api/dashboard';
import { useChartTheme } from '../../lib/chartTheme';
import { brand } from '../../theme/palette.js';

interface Props {
  data: TrendPoint[];
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function TrendLine({ data }: Props) {
  const theme = useChartTheme();
  const chartData = data.map((d) => ({ ...d, label: shortDate(d.date) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme.axisTick.fill }} interval={4} />
        <YAxis tick={theme.axisTick} allowDecimals={false} />
        <Tooltip contentStyle={theme.tooltipStyle} labelStyle={theme.tooltipLabelStyle} />
        <Legend wrapperStyle={theme.legendStyle} />
        <Line
          type="monotone"
          dataKey="created"
          stroke={brand[600]}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0 }}
          name="Created"
        />
        <Line
          type="monotone"
          dataKey="resolved"
          stroke="#10b981"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0 }}
          name="Resolved"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
