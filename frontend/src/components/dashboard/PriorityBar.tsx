import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useChartTheme, PRIORITY_COLORS } from '../../lib/chartTheme';

const PRIORITY_COLOR_LOOKUP: Record<string, string> = {
  CRITICAL: PRIORITY_COLORS.critical,
  HIGH: PRIORITY_COLORS.high,
  MEDIUM: PRIORITY_COLORS.medium,
  LOW: PRIORITY_COLORS.low,
};

const ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

interface Props {
  byPriority: Record<string, number>;
}

export default function PriorityBar({ byPriority }: Props) {
  const theme = useChartTheme();
  const data = ORDER.filter((p) => byPriority[p] !== undefined).map((priority) => ({
    name: priority.charAt(0) + priority.slice(1).toLowerCase(),
    value: byPriority[priority] || 0,
    color: PRIORITY_COLOR_LOOKUP[priority],
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <XAxis dataKey="name" tick={theme.axisTick} />
        <YAxis tick={theme.axisTick} allowDecimals={false} />
        <Tooltip formatter={(value) => [Number(value), 'Issues']} contentStyle={theme.tooltipStyle} labelStyle={theme.tooltipLabelStyle} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
