import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, type LucideIcon } from 'lucide-react';

interface SpotlightBannerProps {
  icon: LucideIcon;
  message: string;
  to: string;
  cta?: string;
}

export default function SpotlightBanner({ icon: Icon, message, to, cta = 'View' }: SpotlightBannerProps) {
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Link
        to={to}
        className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-4 shadow-soft transition-shadow hover:shadow-card dark:border-brand-500/20 dark:from-brand-500/10 dark:to-slate-800"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
            <Icon className="h-4 w-4" />
          </span>
          <p className="min-w-0 text-sm font-medium text-neutral-800 dark:text-slate-200">{message}</p>
        </div>
        <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400 sm:flex">
          {cta} <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </motion.div>
  );
}
