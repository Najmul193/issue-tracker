import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useChartTheme, TYPE_COLORS } from '../../lib/chartTheme';

const TYPE_COLOR_LOOKUP: Record<string, string> = {
  BUG: TYPE_COLORS.bug,
  NEW_REQUIREMENT: TYPE_COLORS.new_requirement,
  CHANGE_REQUEST: TYPE_COLORS.change_request,
  QUERY: TYPE_COLORS.query,
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
  const theme = useChartTheme();
  const data = Object.entries(byType)
    .filter(([, v]) => v > 0)
    .map(([type, value]) => ({
      name: TYPE_LABELS[type] || type,
      value,
      color: TYPE_COLOR_LOOKUP[type] || '#94a3b8',
    }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <XAxis type="number" tick={theme.axisTick} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={80} tick={theme.axisTick} />
        <Tooltip formatter={(value) => [Number(value), 'Issues']} contentStyle={theme.tooltipStyle} labelStyle={theme.tooltipLabelStyle} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
