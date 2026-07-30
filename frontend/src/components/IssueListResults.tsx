import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, Bug, Sparkles, RefreshCw, HelpCircle, Inbox } from 'lucide-react';
import type { Issue, IssueStatus, IssuePriority, IssueType, IssuesResponse } from '../api/issues';
import PriorityBadge from './PriorityBadge';
import StatusBadge from './StatusBadge';
import Pagination from './Pagination';
import Select from './ui/Select';
import Input from './ui/Input';
import Button from './ui/Button';
import Modal from './ui/Modal';
import EmptyState from './ui/EmptyState';
import { Table, Thead, Tbody, Tr, Th, Td } from './ui/Table';
import { staggerContainer, staggerItem } from '../lib/motion';

const statusOptions: { label: string; value: IssueStatus | '' }[] = [
  { label: 'All Statuses', value: '' },
  { label: 'New', value: 'NEW' },
  { label: 'SI Approval', value: 'SI_APPROVAL' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Clarification Requested', value: 'CLARIFICATION_REQUESTED' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },

  { label: 'SI Review', value: 'SI_REVIEW' },
  { label: 'Pending Client Approval', value: 'PENDING_CLIENT_APPROVAL' },
  { label: 'Closed', value: 'CLOSED' },
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

const TYPE_ICON: Record<string, typeof Bug> = {
  BUG: Bug,
  NEW_REQUIREMENT: Sparkles,
  CHANGE_REQUEST: RefreshCw,
  QUERY: HelpCircle,
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDeadlineInfo(deadline: string | null) {
  if (!deadline) return { className: '', label: '' };
  const now = Date.now();
  const dl = new Date(deadline).getTime();
  const remaining = dl - now;
  const totalDuration = dl - new Date(deadline).getTime() + 7 * 24 * 60 * 60 * 1000; // rough estimate
  const pct = totalDuration > 0 ? (remaining / totalDuration) * 100 : 0;

  if (remaining < 0) {
    return { className: 'text-red-600 font-medium dark:text-red-400', label: formatDate(deadline) };
  }
  if (pct < 20) {
    return { className: 'text-amber-600 font-medium dark:text-amber-400', label: formatDate(deadline) };
  }
  return { className: 'text-neutral-500 dark:text-slate-400', label: formatDate(deadline) };
}

function assignedToLabel(issue: Issue): string {
  return (
    issue.assignedToUser?.name ||
    (issue.assignedToDepartment
      ? `${issue.assignedToOrg?.name || 'Org'} (${issue.assignedToDepartment.name})`
      : issue.assignedToOrg
        ? `${issue.assignedToOrg.name} Queue`
        : '—')
  );
}

const sortOptions: { label: string; value: string }[] = [
  { label: 'Newest first', value: '' },
  { label: 'Deadline first', value: 'deadline' },
];

export interface IssueListFilters {
  type: string;
  priority: string;
  status: string;
  overdue: string;
  /** '' (newest first, the default) or 'deadline'. A sort, not a filter — see activeFilterCount. */
  sort?: string;
}

interface IssueListResultsProps {
  filters: IssueListFilters;
  setParam: (key: 'type' | 'priority' | 'status' | 'overdue' | 'sort', value: string) => void;
  searchInput: string;
  onSearchChange: (value: string) => void;
  data: IssuesResponse | null;
  isLoading: boolean;
  error: unknown;
  emptyMessage: string;
  onPageChange: (page: number) => void;
  /**
   * Optional per-row actions. When provided, an extra column is rendered on desktop and an
   * action bar under each mobile card. Omitting it leaves the list exactly as it was.
   */
  rowActions?: (issue: Issue) => ReactNode;
  rowActionsHeader?: string;
}

export default function IssueListResults({
  filters,
  setParam,
  searchInput,
  onSearchChange,
  data,
  isLoading,
  error,
  emptyMessage,
  onPageChange,
  rowActions,
  rowActionsHeader = 'Actions',
}: IssueListResultsProps) {
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  // `sort` is deliberately excluded — choosing an order is not a filter, and counting it
  // would show a phantom "filters active" badge on mobile.
  const activeFilterCount = [filters.type, filters.priority, filters.status, filters.overdue].filter(Boolean).length;

  const filterControls = (
    <>
      <Select value={filters.type} onChange={(e) => setParam('type', e.target.value)}>
        {typeOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <Select value={filters.priority} onChange={(e) => setParam('priority', e.target.value)}>
        {priorityOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <Select value={filters.status} onChange={(e) => setParam('status', e.target.value)}>
        {statusOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={filters.overdue === 'true'}
          onChange={(e) => setParam('overdue', e.target.checked ? 'true' : '')}
          className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700"
        />
        Overdue only
      </label>
      <Select
        value={filters.sort ?? ''}
        onChange={(e) => setParam('sort', e.target.value)}
        aria-label="Sort order"
      >
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </>
  );

  return (
    <div>
      {/* Search + filter trigger */}
      <div className="mb-4 flex items-center gap-2">
        <Input
          icon={<Search />}
          placeholder="Search by title..."
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 sm:max-w-xs"
        />
        <Button
          variant="secondary"
          size="md"
          icon={<SlidersHorizontal />}
          onClick={() => setFilterSheetOpen(true)}
          className="sm:hidden"
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Button>
        <div className="hidden flex-wrap items-center gap-3 sm:flex">{filterControls}</div>
      </div>

      <Modal
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filters"
        footer={
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setParam('type', '');
              setParam('priority', '');
              setParam('status', '');
              setParam('overdue', '');
              setParam('sort', '');
            }}
          >
            Clear all
          </Button>
        }
      >
        <div className="space-y-4">{filterControls}</div>
      </Modal>

      {/* Loading */}
      {isLoading && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-slate-700/60 dark:bg-slate-800">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-full rounded bg-neutral-200 dark:bg-slate-700" />
            <div className="h-4 w-3/4 rounded bg-neutral-200 dark:bg-slate-700" />
            <div className="h-4 w-5/6 rounded bg-neutral-200 dark:bg-slate-700" />
            <div className="h-4 w-2/3 rounded bg-neutral-200 dark:bg-slate-700" />
          </div>
        </div>
      )}

      {error != null && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          Failed to load issues. Please try again later.
        </div>
      )}

      {data && (
        <>
          {data.data.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white dark:border-slate-700/60 dark:bg-slate-800">
              <EmptyState icon={<Inbox />} title={emptyMessage} />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <Thead>
                    <tr>
                      <Th>Title</Th>
                      <Th>Project</Th>
                      <Th>Type</Th>
                      <Th>Priority</Th>
                      <Th>Status</Th>
                      <Th>Assigned To</Th>
                      <Th>Deadline</Th>
                      <Th className="hidden lg:table-cell">Raised By</Th>
                      <Th className="hidden lg:table-cell">Created</Th>
                      {rowActions && <Th>{rowActionsHeader}</Th>}
                    </tr>
                  </Thead>
                  <Tbody>
                    {data.data.map((issue: Issue) => {
                      const deadlineInfo = getDeadlineInfo(issue.deadline);
                      return (
                        <Tr
                          key={issue.id}
                          onClick={() => (window.location.href = `/issues/${issue.id}`)}
                          className="cursor-pointer"
                        >
                          <Td className="max-w-xs truncate font-medium text-neutral-900 dark:text-slate-100">
                            {issue.title}
                          </Td>
                          <Td>{issue.project?.name || '—'}</Td>
                          <Td>{issue.type.replace('_', ' ')}</Td>
                          <Td>
                            <PriorityBadge priority={issue.priority} />
                          </Td>
                          <Td>
                            <StatusBadge status={issue.status} />
                          </Td>
                          <Td>{assignedToLabel(issue)}</Td>
                          <Td className={deadlineInfo.className}>{deadlineInfo.label || '—'}</Td>
                          <Td className="hidden lg:table-cell">{issue.raisedBy.name}</Td>
                          <Td className="hidden lg:table-cell">{formatDate(issue.createdAt)}</Td>
                          {rowActions && (
                            // The row's onClick is a full page navigation, so the whole cell
                            // stops propagation — one guard instead of one per button, and it
                            // also covers anything the actions render inline.
                            <Td onClick={(e) => e.stopPropagation()}>{rowActions(issue)}</Td>
                          )}
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
                <div className="rounded-b-xl border border-t-0 border-neutral-200 bg-white dark:border-slate-700/60 dark:bg-slate-800">
                  <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={onPageChange} />
                </div>
              </div>

              {/* Mobile card list */}
              <motion.ul
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="space-y-3 md:hidden"
              >
                {data.data.map((issue: Issue) => {
                  const deadlineInfo = getDeadlineInfo(issue.deadline);
                  const TypeIcon = TYPE_ICON[issue.type] ?? HelpCircle;
                  return (
                    <motion.li key={issue.id} variants={staggerItem}>
                      {/* The card chrome lives on this wrapper rather than the <a> so the
                          action bar can sit beside the link instead of nested inside it —
                          buttons inside an anchor are invalid and would need preventDefault. */}
                      <div className="rounded-xl border border-neutral-200 bg-white shadow-card transition-shadow hover:shadow-card-hover dark:border-slate-700/60 dark:bg-slate-800">
                      <a
                        href={`/issues/${issue.id}`}
                        className="block p-4"
                      >
                        <p className="line-clamp-2 text-sm font-medium text-neutral-900 dark:text-slate-100">
                          {issue.title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={issue.status} />
                          <PriorityBadge priority={issue.priority} />
                          <span className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-slate-400">
                            <TypeIcon className="h-3 w-3" />
                            {issue.type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-2 truncate text-xs text-neutral-500 dark:text-slate-400">
                          {issue.project?.name || 'No project'} &middot; {assignedToLabel(issue)}
                        </p>
                        {deadlineInfo.label && (
                          <p className={`mt-1 text-xs ${deadlineInfo.className}`}>Due {deadlineInfo.label}</p>
                        )}
                      </a>
                        {rowActions && (
                          <div className="border-t border-neutral-200 px-4 py-2 dark:border-slate-700/60">
                            {rowActions(issue)}
                          </div>
                        )}
                      </div>
                    </motion.li>
                  );
                })}
              </motion.ul>
              <div className="mt-2 rounded-xl border border-neutral-200 bg-white dark:border-slate-700/60 dark:bg-slate-800 md:hidden">
                <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={onPageChange} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
