interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  page,
  limit,
  total,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.ceil(total / limit);

  if (totalPages <= 1) return null;

  const pages: (number | 'ellipsis')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - 1 && i <= page + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }

  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6">
      <div className="text-sm text-gray-500">
        Showing{' '}
        <span className="font-medium">{Math.min((page - 1) * limit + 1, total)}</span>{' '}
        to{' '}
        <span className="font-medium">{Math.min(page * limit, total)}</span> of{' '}
        <span className="font-medium">{total}</span> results
      </div>
      <nav className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        {pages.map((p, idx) =>
          p === 'ellipsis' ? (
            <span key={`e-${idx}`} className="px-2 text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                p === page
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </nav>
    </div>
  );
}