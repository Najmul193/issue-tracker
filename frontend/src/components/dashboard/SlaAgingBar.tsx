import type { SlaAging } from '../../api/dashboard';

interface Props {
  data: SlaAging;
}

const SEGMENTS = [
  { key: 'onTrack', label: 'On Track', color: '#22c55e' },
  { key: 'warning', label: 'Warning', color: '#f59e0b' },
  { key: 'critical', label: 'Critical', color: '#f97316' },
  { key: 'overdue', label: 'Overdue', color: '#ef4444' },
] as const;

export default function SlaAgingBar({ data }: Props) {
  const total = data.onTrack + data.warning + data.critical + data.overdue;

  if (total === 0) {
    return (
      <div className="flex h-12 items-center justify-center text-sm text-gray-400">
        No issues with deadlines
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-gray-100">
        {SEGMENTS.map((seg) => {
          const count = data[seg.key];
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={seg.key}
              style={{ width: `${pct}%`, backgroundColor: seg.color }}
              className="h-full transition-all"
              title={`${seg.label}: ${count}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-4">
        {SEGMENTS.map((seg) => {
          const count = data[seg.key];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={seg.key} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-xs font-medium text-gray-700">{seg.label}</span>
              <span className="text-xs text-gray-500">
                {count} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
