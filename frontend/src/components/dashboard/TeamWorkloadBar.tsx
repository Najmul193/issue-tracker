import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TeamWorkloadEntry } from '../../api/dashboard';

interface Props {
  data: TeamWorkloadEntry[];
}

export default function TeamWorkloadBar({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        No team workload data
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.assignedCount - a.assignedCount);

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, sorted.length * 36 + 40)}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
      >
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="userName" width={100} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="assignedCount" name="Assigned" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        <Bar dataKey="inProgressCount" name="In Progress" fill="#a855f7" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
