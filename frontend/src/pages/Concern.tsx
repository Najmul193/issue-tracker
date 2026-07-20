import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchIssues } from '../api/issues';
import { useProjectFilter } from '../context/ProjectFilterContext';
import type {
  Issue,
  IssueStatus,
  IssuePriority,
  IssueType,
} from '../api/issues';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';

const statusOptions: { label: string; value: IssueStatus | '' }[] = [
  { label: 'All Statuses', value: '' },
  { label: 'New', value: 'NEW' },
  { label: 'Acknowledged', value: 'ACKNOWLEDGED' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Verified', value: 'VERIFIED' },
  { label: 'Closed', value: 'CLOSED' },
  { label: 'Reopened', value: 'REOPENED' },
];

const priorityOptions: { label: string; value: IssuePriority | '' }[] = [
  { label: 'All Priorities', value: '' },
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
];

const typeOptions: { label: string; value: IssueType | '' }[] = [
  { label: 'All Types', value: '' },
  { label: 'Bug', value: 'BUG' },
  { label: 'New Requirement', value: 'NEW_REQUIREMENT' },
  { label: 'Change Request', value: 'CHANGE_REQUEST' },
  { label: 'Query', value: 'QUERY' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDeadlineInfo(deadline: string | null) {
  if (!deadline) return { className: '', label: '' };
  const now = Date.now();
  const dl = new Date(deadline).getTime();
  const remaining = dl - now;
  const totalDuration = dl - new Date(deadline).getTime() + 7 * 24 * 60 * 60 * 1000;
  const pct = totalDuration > 0 ? (remaining / totalDuration) * 100 : 0;

  if (remaining < 0) {
    return { className: 'text-red-600 font-medium', label: formatDate(deadline) };
  }
  if (pct < 20) {
    return { className: 'text-amber-600 font-medium', label: formatDate(deadline) };
  }
  return { className: 'text-gray-500', label: formatDate(deadline) };
}

export default function Concern() {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const type = searchParams.get('type') || '';
  const overdue = searchParams.get('overdue') || '';
  const module = searchParams.get('module') || '';
  const concernFilter = searchParams.get('concernFilter') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [searchInput, setSearchInput] = useState('');
  const { projectIdsParam } = useProjectFilter();

  const queryParams = useMemo(
    () => ({
      concern: 'true',
      ...(concernFilter ? { concernFilter } : {}),
      ...(status ? { status: status as IssueStatus } : {}),
      ...(priority ? { priority: priority as IssuePriority } : {}),
      ...(type ? { type: type as IssueType } : {}),
      ...(overdue ? { overdue } : {}),
      ...(module ? { module } : {}),
      ...(projectIdsParam ? { projectIds: projectIdsParam } : {}),
      page: String(page),
      limit: '20',
    }),
    [concernFilter, status, priority, type, overdue, module, projectIdsParam, page],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['concern', queryParams],
    queryFn: () => fetchIssues(queryParams),
  });

  const setParam = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        if (key !== 'page') next.delete('page');
        return next;
      });
    },
    [setSearchParams],
  );

  const filteredData = useMemo(() => {
    if (!data) return null;
    if (!searchInput.trim()) return data;
    const q = searchInput.toLowerCase();
    return {
      ...data,
      data: data.data.filter((issue) =>
        issue.title.toLowerCase().includes(q),
      ),
    };
  }, [data, searchInput]);

  function handleSearchInput(value: string) {
    setSearchInput(value);
  }

  return (
    <div>
      {/* Header row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Concern</h2>
      </div>

      {/* Concern type filter */}
      <div className="mb-4 flex items-center gap-1">
        {['', 'raised', 'assigned'].map((f) => {
          const label = f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1);
          return (
            <button
              key={f}
              onClick={() => setParam('concernFilter', f)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                concernFilter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={type}
          onChange={(e) => setParam('type', e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setParam('priority', e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {priorityOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={overdue === 'true'}
            onChange={(e) =>
              setParam('overdue', e.target.checked ? 'true' : '')
            }
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Overdue only
        </label>
        <input
          type="text"
          placeholder="Search by title..."
          value={searchInput}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="ml-auto rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-56"
        />
      </div>

      {/* Table */}
      {isLoading && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="animate-pulse p-6">
            <div className="h-4 w-full rounded bg-gray-200" />
            <div className="mt-4 h-4 w-3/4 rounded bg-gray-200" />
            <div className="mt-4 h-4 w-5/6 rounded bg-gray-200" />
            <div className="mt-4 h-4 w-2/3 rounded bg-gray-200" />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load issues. Please try again later.
        </div>
      )}

      {filteredData && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Project
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Assigned To
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Deadline
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Raised By
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.data.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    No issues related to you.
                  </td>
                </tr>
              )}
              {filteredData.data.map((issue: Issue) => {
                const deadlineInfo = getDeadlineInfo(issue.deadline);
                return (
                  <tr
                    key={issue.id}
                    onClick={() =>
                      (window.location.href = `/issues/${issue.id}`)
                    }
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="max-w-xs truncate px-4 py-3 text-sm font-medium text-gray-900">
                      {issue.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {issue.project?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {issue.type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={issue.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={issue.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {issue.assignedToUser?.name ||
                        (issue.assignedToDepartment
                          ? `${issue.assignedToOrg?.name || 'Org'} (${issue.assignedToDepartment.name})`
                          : issue.assignedToOrg
                            ? `${issue.assignedToOrg.name} Queue`
                            : '—')}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm ${deadlineInfo.className}`}
                    >
                      {deadlineInfo.label || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {issue.raisedBy.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(issue.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            page={filteredData.page}
            limit={filteredData.limit}
            total={filteredData.total}
            onPageChange={(newPage) => setParam('page', String(newPage))}
          />
        </div>
      )}
    </div>
  );
}
