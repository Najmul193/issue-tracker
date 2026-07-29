import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

export function Table({ className = '', children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-xl border border-neutral-200 shadow-card dark:border-slate-700/60">
      <table className={`min-w-full divide-y divide-neutral-200 dark:divide-slate-700 ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ className = '', children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-neutral-50 dark:bg-slate-800/60 ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function Tbody({ className = '', children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={`divide-y divide-neutral-100 bg-white dark:divide-slate-700/60 dark:bg-slate-800 ${className}`}
      {...props}
    >
      {children}
    </tbody>
  );
}

export function Tr({ className = '', children, ...props }: HTMLMotionProps<'tr'>) {
  return (
    <motion.tr layout className={`transition-colors hover:bg-neutral-50 dark:hover:bg-slate-700/40 ${className}`} {...props}>
      {children}
    </motion.tr>
  );
}

export function Th({ className = '', children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400 ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ className = '', children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 text-sm text-neutral-700 dark:text-slate-300 ${className}`} {...props}>
      {children}
    </td>
  );
}
