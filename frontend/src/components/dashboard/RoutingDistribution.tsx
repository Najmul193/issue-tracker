import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { RoutingDistributionEntry } from '../../api/dashboard';
import { useChartTheme } from '../../lib/chartTheme';
import { brand } from '../../theme/palette.js';

interface Props {
  data: RoutingDistributionEntry[];
}

export default function RoutingDistribution({ data }: Props) {
  const theme = useChartTheme();

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-neutral-400 dark:text-slate-500">
        No routing data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} />
        <XAxis dataKey="orgName" tick={theme.axisTick} />
        <YAxis tick={theme.axisTick} allowDecimals={false} />
        <Tooltip contentStyle={theme.tooltipStyle} labelStyle={theme.tooltipLabelStyle} />
        <Legend wrapperStyle={theme.legendStyle} />
        <Bar dataKey="assignedCount" name="Assigned To" fill={brand[600]} radius={[6, 6, 0, 0]} />
        <Bar dataKey="raisedCount" name="Raised By" fill="#94a3b8" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
