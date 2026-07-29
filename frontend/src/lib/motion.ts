import type { Transition, Variants } from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1] as const;

export const DURATION = { fast: 0.15, base: 0.2, slow: 0.32 };

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE } },
  exit: { opacity: 0, y: -4, transition: { duration: DURATION.fast, ease: EASE } },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE } },
};

export const modalOverlay: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

export const modalPanel: Variants = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.18, ease: EASE } },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.12, ease: EASE } },
};

// Mobile bottom-sheet variant of the modal panel (slides up instead of scaling in place)
export const sheetPanel: Variants = {
  initial: { opacity: 0, y: '100%' },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
  exit: { opacity: 0, y: '100%', transition: { duration: 0.16, ease: EASE } },
};

export const dropdownVariants: Variants = {
  initial: { opacity: 0, y: -4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.12, ease: EASE } },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } },
};

export const drawerVariants: Variants = {
  initial: { x: '-100%' },
  animate: { x: 0, transition: { duration: 0.22, ease: EASE } },
  exit: { x: '-100%', transition: { duration: 0.18, ease: EASE } },
};

export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.base } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
};

export const tapScale: Transition = { duration: 0.1 };
