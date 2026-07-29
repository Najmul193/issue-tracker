import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-14 text-center ${className}`}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-slate-700/60 dark:text-slate-500 [&>svg]:h-7 [&>svg]:w-7">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-slate-200">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-neutral-500 dark:text-slate-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
