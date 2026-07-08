export default function SkeletonSection({ height = 220 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-lg border border-gray-200 bg-white p-4"
      style={{ height }}
    >
      <div className="h-3 w-32 rounded bg-gray-200 mb-4" />
      <div className="h-full rounded bg-gray-100" style={{ height: height - 52 }} />
    </div>
  );
}
