import type { OrgSummary } from '../../api/dashboard';
import { Table, Thead, Tbody, Tr, Th, Td } from '../ui/Table';

interface Props {
  data: OrgSummary;
}

export default function OrgSummaryPanel({ data }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-brand-50 p-3 dark:bg-brand-500/10">
          <p className="text-xs font-medium text-brand-700 dark:text-brand-400">Total Open</p>
          <p className="mt-0.5 text-xl font-bold text-brand-900 dark:text-brand-300">{data.totalOpen}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-500/10">
          <p className="text-xs font-medium text-red-700 dark:text-red-400">Overdue</p>
          <p className="mt-0.5 text-xl font-bold text-red-900 dark:text-red-300">{data.totalOverdue}</p>
        </div>
      </div>

      {data.teamMembers.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400">
            Team Workload
          </p>
          <Table>
            <Thead>
              <tr>
                <Th>Member</Th>
                <Th className="text-right">Assigned</Th>
                <Th className="text-right">Resolved</Th>
              </tr>
            </Thead>
            <Tbody>
              {data.teamMembers.map((m) => (
                <Tr key={m.userId}>
                  <Td className="font-medium text-neutral-900 dark:text-slate-100">{m.userName}</Td>
                  <Td className="text-right">
                    <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-500/15 dark:text-violet-400">
                      {m.assignedCount}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-500/15 dark:text-green-400">
                      {m.resolvedCount}
                    </span>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
