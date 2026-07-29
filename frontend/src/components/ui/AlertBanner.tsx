import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

type Tone = 'error' | 'success' | 'warning' | 'info';

const TONE_CONFIG: Record<Tone, { icon: typeof AlertCircle; classes: string }> = {
  error: {
    icon: AlertCircle,
    classes: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400',
  },
  success: {
    icon: CheckCircle2,
    classes:
      'border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400',
  },
  warning: {
    icon: AlertTriangle,
    classes:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  },
  info: {
    icon: Info,
    classes: 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400',
  },
};

export default function AlertBanner({ tone, children }: { tone: Tone; children: ReactNode }) {
  const { icon: Icon, classes } = TONE_CONFIG[tone];
  return (
    <motion.div
      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${classes}`}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">{children}</div>
      </div>
    </motion.div>
  );
}
