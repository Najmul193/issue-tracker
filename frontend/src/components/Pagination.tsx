import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);

  if (totalPages <= 1) return null;

  const pages: (number | 'ellipsis')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-neutral-200 px-4 py-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="text-sm text-neutral-500 dark:text-slate-400">
        Showing{' '}
        <span className="font-medium text-neutral-700 dark:text-slate-200">
          {Math.min((page - 1) * limit + 1, total)}
        </span>{' '}
        to{' '}
        <span className="font-medium text-neutral-700 dark:text-slate-200">
          {Math.min(page * limit, total)}
        </span>{' '}
        of <span className="font-medium text-neutral-700 dark:text-slate-200">{total}</span> results
      </div>
      <nav className="flex items-center justify-between gap-1 sm:justify-end">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <span className="text-sm text-neutral-500 dark:text-slate-400 sm:hidden">
          Page {page} of {totalPages}
        </span>
        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((p, idx) =>
            p === 'ellipsis' ? (
              <span key={`e-${idx}`} className="px-2 text-neutral-400 dark:text-slate-500">
                &hellip;
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-brand-600 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {p}
              </button>
            ),
          )}
        </div>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
