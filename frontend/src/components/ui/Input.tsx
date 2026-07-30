import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  trailingAdornment?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, icon, trailingAdornment, id, className = '', ...props },
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
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400 dark:text-slate-500 [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          className={`block w-full rounded-lg border text-base text-neutral-900 shadow-soft placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 sm:text-sm ${
            icon ? 'pl-9' : 'pl-3'
          } ${trailingAdornment ? 'pr-10' : 'pr-3'} py-2 ${
            error
              ? 'border-red-300 dark:border-red-500/60'
              : 'border-neutral-300 dark:border-slate-600'
          } ${className}`}
          {...props}
        />
        {trailingAdornment && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-neutral-400 dark:text-slate-500">
            {trailingAdornment}
          </span>
        )}
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-neutral-400 dark:text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});

export default Input;
