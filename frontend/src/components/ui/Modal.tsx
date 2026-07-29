import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { modalOverlay, modalPanel } from '../../lib/motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-lg',
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            variants={modalOverlay}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm dark:bg-black/60"
            onClick={onClose}
          />
          <motion.div
            variants={modalPanel}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-modal dark:bg-slate-800 sm:max-h-[85vh] sm:rounded-2xl sm:${maxWidth}`}
          >
            {title && (
              <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-slate-700">
                <h2 className="text-base font-semibold text-neutral-900 dark:text-slate-100">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <div className="shrink-0 border-t border-neutral-200 px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] dark:border-slate-700 sm:pb-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
