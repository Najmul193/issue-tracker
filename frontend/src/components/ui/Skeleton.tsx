export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-200 dark:bg-slate-700 ${className}`} />;
}

export function SkeletonCard({ height = 96 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-slate-700/60 dark:bg-slate-800"
      style={{ height }}
    >
      <div className="h-3 w-24 rounded bg-neutral-200 dark:bg-slate-700" />
      <div className="mt-3 h-full rounded bg-neutral-100 dark:bg-slate-700/60" />
    </div>
  );
}
