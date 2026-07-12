import { useState, useRef, useEffect } from 'react';
import { useProjectFilter } from '../context/ProjectFilterContext';

export default function ProjectFilterDropdown() {
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

  // Close on outside click
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

  // Determine button text
  let buttonText: string;
  if (isAllSelected) {
    buttonText = 'All Projects';
  } else if (selectedCount === 0) {
    buttonText = 'No Projects';
  } else {
    buttonText = `${selectedCount} of ${total} Projects`;
  }

  // Determine button style
  const isNothingSelected = selectedCount === 0 && !isAllSelected;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          isNothingSelected
            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
            : isFiltered
              ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent'
        }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        {buttonText}
        <svg className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Select All toggle */}
          <div className="border-b border-gray-100 px-3 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={() => {
                  if (isAllSelected) {
                    clearAll();
                  } else {
                    selectAll();
                  }
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              All Projects
            </label>
          </div>

          {/* Project list */}
          <div className="max-h-60 overflow-y-auto">
            {allProjects.map((project) => (
              <label
                key={project.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedProjectIds.includes(project.id)}
                  onChange={() => toggleProject(project.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="min-w-0 truncate text-gray-700">{project.name}</span>
              </label>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-400">
            {selectedCount} of {total} selected
          </div>
        </div>
      )}
    </div>
  );
}
