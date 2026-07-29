import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-50 px-4 py-12 dark:bg-slate-900">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-500/10" />
      <div className="relative w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-card dark:border-slate-700/60 dark:bg-slate-800"
        >
          <div className="mb-8 text-center">
            <img src="/logo.png" alt="Data Edge Ltd" className="mx-auto mb-4 h-14 w-auto" />
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-slate-100">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-neutral-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          {children}
        </motion.div>
        <p className="mt-4 text-center text-xs text-neutral-400 dark:text-slate-500">
          Powered by <strong>Data Edge Ltd</strong>
        </p>
      </div>
    </div>
  );
}
