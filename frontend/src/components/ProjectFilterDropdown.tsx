import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FolderKanban, ChevronDown } from 'lucide-react';
import { useProjectFilter } from '../context/ProjectFilterContext';
import { dropdownVariants } from '../lib/motion';

interface ProjectFilterDropdownProps {
  /** 'dropdown' (default) renders a floating popover; 'inline' renders the picker body directly, for embedding in a mobile sheet. */
  variant?: 'dropdown' | 'inline';
}

export default function ProjectFilterDropdown({ variant = 'dropdown' }: ProjectFilterDropdownProps) {
  const {
    allProjects,
    selectedProjectIds,
    toggleProject,
    selectAll,
    clearAll,
    isAllSelected,
    hasProjects,
    isLoadingProjects,
  } = useProjectFilter();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [isOpen]);

  if (isLoadingProjects) return null;
  if (!hasProjects) return null;

  const selectedCount = selectedProjectIds.length;
  const total = allProjects.length;
  const isFiltered = !isAllSelected;
  const isNothingSelected = selectedCount === 0 && !isAllSelected;

  let buttonText: string;
  if (isAllSelected) {
    buttonText = 'All Projects';
  } else if (selectedCount === 0) {
    buttonText = 'No Projects';
  } else {
    buttonText = `${selectedCount} of ${total} Projects`;
  }

  const listBody = (
    <>
      <div className="border-b border-neutral-100 px-3 py-2 dark:border-slate-700">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={() => (isAllSelected ? clearAll() : selectAll())}
            className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700"
          />
          All Projects
        </label>
      </div>
      <div className="scrollbar-thin max-h-60 overflow-y-auto">
        {allProjects.map((project) => (
          <label
            key={project.id}
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-slate-700/60"
          >
            <input
              type="checkbox"
              checked={selectedProjectIds.includes(project.id)}
              onChange={() => toggleProject(project.id)}
              className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700"
            />
            <span className="min-w-0 truncate text-neutral-700 dark:text-slate-300">{project.name}</span>
          </label>
        ))}
      </div>
      <div className="border-t border-neutral-100 px-3 py-2 text-xs text-neutral-400 dark:border-slate-700 dark:text-slate-500">
        {selectedCount} of {total} selected
      </div>
    </>
  );

  if (variant === 'inline') {
    return (
      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-slate-700">
        {listBody}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          isNothingSelected
            ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
            : isFiltered
              ? 'border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400'
              : 'border border-transparent bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
        }`}
      >
        <FolderKanban className="h-4 w-4" />
        {buttonText}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={dropdownVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute right-0 z-50 mt-1 w-72 rounded-xl border border-neutral-200 bg-white shadow-popover dark:border-slate-700 dark:bg-slate-800"
          >
            {listBody}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
