import type { ReactNode } from 'react';

interface BadgeProps {
  icon?: ReactNode;
  /** Tailwind class fragment for bg/text/ring color, e.g. "bg-status-new/10 text-status-new ring-status-new/30" */
  tone?: string;
  children: ReactNode;
  className?: string;
}

const DEFAULT_TONE =
  'bg-neutral-100 text-neutral-600 ring-neutral-500/10 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600/40';

export default function Badge({ icon, tone = DEFAULT_TONE, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tone} ${className}`}
    >
      {icon && <span className="shrink-0 [&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
      {children}
    </span>
  );
}
