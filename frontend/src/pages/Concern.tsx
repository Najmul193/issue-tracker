import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { fetchIssues } from '../api/issues';
import { useProjectFilter } from '../context/ProjectFilterContext';
import type { IssueStatus, IssuePriority, IssueType } from '../api/issues';
import IssueListResults from '../components/IssueListResults';
import IssueQuickActions from '../components/IssueQuickActions';
import AlertBanner from '../components/ui/AlertBanner';

const CONCERN_TABS = ['', 'raised', 'assigned', 'approval'] as const;

const TAB_LABELS: Record<string, string> = {
  '': 'All',
  raised: 'Raised',
  assigned: 'Assigned',
  approval: 'Approval',
};

export default function Concern() {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const type = searchParams.get('type') || '';
  const overdue = searchParams.get('overdue') || '';
  const module = searchParams.get('module') || '';
  const concernFilter = searchParams.get('concernFilter') || '';
  const sort = searchParams.get('sort') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [searchInput, setSearchInput] = useState('');
  const [actionResult, setActionResult] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  // Rows mid-action (modal open or request in flight) — polling pauses while any is busy,
  // so a refetch can't unmount the row and take the user's half-typed comment with it.
  const [busyRows, setBusyRows] = useState<Set<string>>(new Set());
  const setRowBusy = useCallback((issueId: string, busy: boolean) => {
    setBusyRows((prev) => {
      if (prev.has(issueId) === busy) return prev;
      const next = new Set(prev);
      if (busy) next.add(issueId);
      else next.delete(issueId);
      return next;
    });
  }, []);
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
      ...(sort ? { sort } : {}),
      ...(projectIdsParam ? { projectIds: projectIdsParam } : {}),
      page: String(page),
      limit: '20',
    }),
    [concernFilter, status, priority, type, overdue, module, sort, projectIdsParam, page],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['concern', queryParams],
    queryFn: () => fetchIssues(queryParams),
    refetchInterval: busyRows.size > 0 ? false : 15_000,
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

  // Acting on the last row of a page empties it; step back rather than show "no issues".
  useEffect(() => {
    if (!isLoading && data && data.data.length === 0 && page > 1) {
      setParam('page', String(page - 1));
    }
  }, [isLoading, data, page, setParam]);

  const filteredData = useMemo(() => {
    if (!data) return null;
    if (!searchInput.trim()) return data;
    const q = searchInput.toLowerCase();
    return {
      ...data,
      data: data.data.filter((issue) => issue.title.toLowerCase().includes(q)),
    };
  }, [data, searchInput]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">Concern</h2>
      </div>

      {/* Concern type filter */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-slate-800 sm:inline-flex sm:w-auto">
        {CONCERN_TABS.map((f) => (
          <button
            key={f}
            onClick={() => {
              // Cleared on tab change only — not in setParam, or the automatic page
              // step-back after an action would wipe the confirmation instantly.
              setActionResult(null);
              setParam('concernFilter', f);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 ${
              concernFilter === f
                ? 'bg-brand-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-200 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {TAB_LABELS[f]}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {actionResult && (
          <AlertBanner tone={actionResult.tone}>{actionResult.message}</AlertBanner>
        )}
      </AnimatePresence>

      <IssueListResults
        filters={{ type, priority, status, overdue, sort }}
        setParam={setParam}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        data={filteredData}
        isLoading={isLoading}
        error={error}
        emptyMessage={
          concernFilter === 'approval'
            ? 'Nothing awaiting your action.'
            : 'No issues related to you.'
        }
        onPageChange={(newPage) => setParam('page', String(newPage))}
        rowActions={
          concernFilter === 'approval'
            ? (issue) => (
                <IssueQuickActions
                  issue={issue}
                  onResult={setActionResult}
                  onBusyChange={setRowBusy}
                />
              )
            : undefined
        }
      />
    </div>
  );
}
