import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  padded?: boolean;
  children: ReactNode;
}

export default function Card({
  title,
  icon,
  action,
  padded = true,
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white shadow-card dark:border-slate-700/60 dark:bg-slate-800 ${padded ? 'p-4' : ''} ${className}`}
      {...props}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && (
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400">
              {icon && <span className="text-neutral-400 dark:text-slate-500 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
