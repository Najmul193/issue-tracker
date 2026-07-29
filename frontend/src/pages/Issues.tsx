import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { fetchIssues } from '../api/issues';
import { useProjectFilter } from '../context/ProjectFilterContext';
import type { IssueStatus, IssuePriority, IssueType } from '../api/issues';
import IssueListResults from '../components/IssueListResults';
import Button from '../components/ui/Button';

export default function Issues() {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const type = searchParams.get('type') || '';
  const overdue = searchParams.get('overdue') || '';
  const module = searchParams.get('module') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [searchInput, setSearchInput] = useState('');
  const { projectIdsParam } = useProjectFilter();

  const queryParams = useMemo(
    () => ({
      ...(status ? { status: status as IssueStatus } : {}),
      ...(priority ? { priority: priority as IssuePriority } : {}),
      ...(type ? { type: type as IssueType } : {}),
      ...(overdue ? { overdue } : {}),
      ...(module ? { module } : {}),
      ...(projectIdsParam ? { projectIds: projectIdsParam } : {}),
      page: String(page),
      limit: '20',
    }),
    [status, priority, type, overdue, module, projectIdsParam, page],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['issues', queryParams],
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

  // Debounced client-side search input
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">Issues</h2>
        <Link to="/issues/new">
          <Button icon={<Plus />}>Create Issue</Button>
        </Link>
      </div>

      <IssueListResults
        filters={{ type, priority, status, overdue }}
        setParam={setParam}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        data={filteredData}
        isLoading={isLoading}
        error={error}
        emptyMessage="No issues found."
        onPageChange={(newPage) => setParam('page', String(newPage))}
      />
    </div>
  );
}
