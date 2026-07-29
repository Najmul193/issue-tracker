import { forwardRef, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className = '', ...props },
  ref,
) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-neutral-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={`block w-full rounded-lg border text-base text-neutral-900 shadow-soft placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 sm:text-sm px-3 py-2 ${
          label ? 'mt-1' : ''
        } ${
          error
            ? 'border-red-300 dark:border-red-500/60'
            : 'border-neutral-300 dark:border-slate-600'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-neutral-400 dark:text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});

export default Textarea;
