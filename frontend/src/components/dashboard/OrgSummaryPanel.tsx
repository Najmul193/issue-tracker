import { Link } from 'react-router-dom';
import type { OrgSummary } from '../../api/dashboard';

interface Props {
  data: OrgSummary;
}

export default function OrgSummaryPanel({ data }: Props) {
  return (
    <div className="space-y-4">
      {/* Org-level stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md bg-blue-50 p-3">
          <p className="text-xs font-medium text-blue-700">Total Open</p>
          <p className="mt-0.5 text-xl font-bold text-blue-900">{data.totalOpen}</p>
        </div>
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-xs font-medium text-red-700">Overdue</p>
          <p className="mt-0.5 text-xl font-bold text-red-900">{data.totalOverdue}</p>
        </div>
      </div>

      {/* Team members table */}
      {data.teamMembers.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Team Workload
          </p>
          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Member</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Assigned</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Resolved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.teamMembers.map((m) => (
                  <tr key={m.userId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{m.userName}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                        {m.assignedCount}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        {m.resolvedCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
