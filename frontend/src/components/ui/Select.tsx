import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id, className = '', children, ...props },
  ref,
) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-neutral-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <div className={`relative ${label ? 'mt-1' : ''}`}>
        <select
          ref={ref}
          id={id}
          className={`block w-full appearance-none rounded-lg border bg-white text-base text-neutral-900 shadow-soft focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:bg-slate-800 dark:text-slate-100 sm:text-sm px-3 py-2 pr-9 ${
            error
              ? 'border-red-300 dark:border-red-500/60'
              : 'border-neutral-300 dark:border-slate-600'
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-neutral-400 dark:text-slate-500" />
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});

export default Select;
