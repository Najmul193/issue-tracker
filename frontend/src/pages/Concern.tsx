import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchIssues } from '../api/issues';
import { useProjectFilter } from '../context/ProjectFilterContext';
import type { IssueStatus, IssuePriority, IssueType } from '../api/issues';
import IssueListResults from '../components/IssueListResults';

const CONCERN_TABS = ['', 'raised', 'assigned'] as const;

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
    refetchInterval: 15_000,
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
      data: data.data.filter((issue) => issue.title.toLowerCase().includes(q)),
    };
  }, [data, searchInput]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">Concern</h2>
      </div>

      {/* Concern type filter */}
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-slate-800 sm:inline-flex sm:w-auto">
        {CONCERN_TABS.map((f) => {
          const label = f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1);
          return (
            <button
              key={f}
              onClick={() => setParam('concernFilter', f)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                concernFilter === f
                  ? 'bg-brand-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-200 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <IssueListResults
        filters={{ type, priority, status, overdue }}
        setParam={setParam}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        data={filteredData}
        isLoading={isLoading}
        error={error}
        emptyMessage="No issues related to you."
        onPageChange={(newPage) => setParam('page', String(newPage))}
      />
    </div>
  );
}
