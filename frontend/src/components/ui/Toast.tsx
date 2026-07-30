import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { toastVariants } from '../../lib/motion';

/**
 * App-wide toast/snackbar notifications — floating, auto-dismissing confirmations for actions
 * taken from compact spaces (e.g. a dashboard card) where a full-width page banner like
 * `AlertBanner` wouldn't fit.
 *
 * Deliberately opt-in per call site: `<AlertBanner>`-based pages (the Concern/Approval tab) are
 * untouched — nothing here changes their behavior. `useToast()`'s `showToast` takes the exact
 * same `{ tone, message }` shape `IssueQuickActions`'s `onResult` callback already produces, so
 * wiring the two together is `onResult={showToast}` with no glue code.
 */

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastResult {
  tone: ToastTone;
  message: string;
}

interface ToastItem extends ToastResult {
  id: number;
}

const TONE_CONFIG: Record<ToastTone, { icon: typeof AlertCircle; classes: string }> = {
  error: {
    icon: AlertCircle,
    classes:
      'border-red-200 bg-white text-red-700 dark:border-red-500/30 dark:bg-slate-800 dark:text-red-400',
  },
  success: {
    icon: CheckCircle2,
    classes:
      'border-green-200 bg-white text-green-700 dark:border-green-500/30 dark:bg-slate-800 dark:text-green-400',
  },
  warning: {
    icon: AlertTriangle,
    classes:
      'border-amber-200 bg-white text-amber-700 dark:border-amber-500/30 dark:bg-slate-800 dark:text-amber-400',
  },
  info: {
    icon: Info,
    classes:
      'border-brand-200 bg-white text-brand-700 dark:border-brand-500/30 dark:bg-slate-800 dark:text-brand-400',
  },
};

// Errors stay up longer — worth actually reading before it vanishes.
const DISMISS_MS: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  warning: 4500,
  error: 5000,
};

const ToastContext = createContext<((result: ToastResult) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (result: ToastResult) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { ...result, id }]);
      const timer = setTimeout(() => dismiss(id), DISMISS_MS[result.tone]);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end">
          <AnimatePresence>
            {toasts.map((t) => {
              const { icon: Icon, classes } = TONE_CONFIG[t.tone];
              return (
                <motion.div
                  key={t.id}
                  layout
                  variants={toastVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-modal ${classes}`}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">{t.message}</div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss"
                    className="shrink-0 rounded-full p-0.5 opacity-60 hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

/** Returns a function matching `IssueQuickActions`'s `onResult` shape exactly. */
export function useToast(): (result: ToastResult) => void {
  const showToast = useContext(ToastContext);
  if (!showToast) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return showToast;
}
