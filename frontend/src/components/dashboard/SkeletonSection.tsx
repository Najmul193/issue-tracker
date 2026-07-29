export default function SkeletonSection({ height = 220 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-xl border border-neutral-200 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800"
      style={{ height }}
    >
      <div className="mb-4 h-3 w-32 rounded bg-neutral-200 dark:bg-slate-700" />
      <div className="rounded bg-neutral-100 dark:bg-slate-700/60" style={{ height: height - 52 }} />
    </div>
  );
}
