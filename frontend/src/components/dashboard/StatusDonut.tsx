import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useChartTheme, STATUS_COLORS } from '../../lib/chartTheme';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  SI_APPROVAL: 'SI Approval',
  UNDER_REVIEW: 'Under Review',
  CLARIFICATION_REQUESTED: 'Clarification Requested',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',

  SI_REVIEW: 'SI Review',
  PENDING_CLIENT_APPROVAL: 'Pending Approval',
  CLOSED: 'Closed',
};

const STATUS_COLOR_LOOKUP: Record<string, string> = {
  NEW: STATUS_COLORS.new,
  SI_APPROVAL: STATUS_COLORS.si_approval,
  UNDER_REVIEW: STATUS_COLORS.under_review,
  CLARIFICATION_REQUESTED: STATUS_COLORS.clarification_requested,
  ASSIGNED: STATUS_COLORS.assigned,
  IN_PROGRESS: STATUS_COLORS.in_progress,

  SI_REVIEW: STATUS_COLORS.si_review,
  PENDING_CLIENT_APPROVAL: STATUS_COLORS.pending_client_approval,
  CLOSED: STATUS_COLORS.closed,
};

interface Props {
  byStatus: Record<string, number>;
}

export default function StatusDonut({ byStatus }: Props) {
  const theme = useChartTheme();
  const data = Object.entries(byStatus)
    .filter(([, v]) => v > 0)
    .map(([status, value]) => ({
      name: STATUS_LABELS[status] || status,
      value,
      color: STATUS_COLOR_LOOKUP[status] || '#94a3b8',
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-400 dark:text-slate-500">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [Number(value), String(name)]}
          contentStyle={theme.tooltipStyle}
          labelStyle={theme.tooltipLabelStyle}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={theme.legendStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
