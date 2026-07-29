import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { OrgComparison } from '../../api/dashboard';
import { useChartTheme } from '../../lib/chartTheme';
import { brand } from '../../theme/palette.js';

interface Props {
  data: OrgComparison[];
}

export default function OrgComparisonBar({ data }: Props) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} />
        <XAxis dataKey="orgName" tick={theme.axisTick} />
        <YAxis tick={theme.axisTick} allowDecimals={false} />
        <Tooltip contentStyle={theme.tooltipStyle} labelStyle={theme.tooltipLabelStyle} />
        <Legend wrapperStyle={theme.legendStyle} />
        <Bar dataKey="open" name="Open Issues" fill={brand[600]} radius={[6, 6, 0, 0]} />
        <Bar dataKey="overdue" name="Overdue" fill="#ef4444" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
