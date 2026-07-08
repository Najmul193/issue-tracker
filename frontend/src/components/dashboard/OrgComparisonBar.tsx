import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { OrgComparison } from '../../api/dashboard';

interface Props {
  data: OrgComparison[];
}

export default function OrgComparisonBar({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="orgName" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="open" name="Open Issues" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="overdue" name="Overdue" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
