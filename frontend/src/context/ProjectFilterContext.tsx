import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchProjects } from '../api/projects';
import type { Project } from '../api/projects';
import { useAuth } from './AuthContext';

interface ProjectFilterContextValue {
  allProjects: Project[];
  selectedProjectIds: string[];
  setSelectedProjectIds: (ids: string[]) => void;
  toggleProject: (id: string) => void;
  selectAll: () => void;
  isAllSelected: boolean;
  hasProjects: boolean;
  isLoadingProjects: boolean;
  projectIdsParam: string | null;
}

const ProjectFilterContext = createContext<ProjectFilterContextValue | null>(null);

export function ProjectFilterProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialized, setInitialized] = useState(false);

  const { data: allProjects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    enabled: isAuthenticated,
  });

  const hasProjects = allProjects.length > 0;

  // Read initial selection from URL params, or default to all
  const urlParam = searchParams.get('projects');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Initialize selection once projects are loaded
  useEffect(() => {
    if (initialized || isLoadingProjects) return;
    if (allProjects.length === 0) {
      setInitialized(true);
      return;
    }
    if (urlParam) {
      const ids = urlParam.split(',').filter((id) =>
        allProjects.some((p) => p.id === id),
      );
      if (ids.length > 0) {
        setSelectedIds(ids);
      } else {
        setSelectedIds(allProjects.map((p) => p.id));
      }
    } else {
      setSelectedIds(allProjects.map((p) => p.id));
    }
    setInitialized(true);
  }, [allProjects, isLoadingProjects, initialized, urlParam]);

  const isAllSelected = selectedIds.length === allProjects.length && allProjects.length > 0;

  // Sync to URL params
  useEffect(() => {
    if (!initialized) return;
    const next = new URLSearchParams(searchParams);
    if (isAllSelected || selectedIds.length === 0) {
      next.delete('projects');
    } else {
      next.set('projects', selectedIds.join(','));
    }
    setSearchParams(next, { replace: true });
  }, [selectedIds, initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSelectedProjectIds = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const toggleProject = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((pid) => pid !== id);
      }
      return [...prev, id];
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(allProjects.map((p) => p.id));
  }, [allProjects]);

  // Comma-separated param for API calls; null when all selected
  const projectIdsParam = useMemo(() => {
    if (isAllSelected || selectedIds.length === 0) return null;
    return selectedIds.join(',');
  }, [selectedIds, isAllSelected]);

  const value = useMemo<ProjectFilterContextValue>(
    () => ({
      allProjects,
      selectedProjectIds: selectedIds,
      setSelectedProjectIds,
      toggleProject,
      selectAll,
      isAllSelected,
      hasProjects,
      isLoadingProjects,
      projectIdsParam,
    }),
    [
      allProjects,
      selectedIds,
      setSelectedProjectIds,
      toggleProject,
      selectAll,
      isAllSelected,
      hasProjects,
      isLoadingProjects,
      projectIdsParam,
    ],
  );

  return (
    <ProjectFilterContext.Provider value={value}>
      {children}
    </ProjectFilterContext.Provider>
  );
}

export function useProjectFilter(): ProjectFilterContextValue {
  const ctx = useContext(ProjectFilterContext);
  if (!ctx) {
    throw new Error('useProjectFilter must be used within a ProjectFilterProvider');
  }
  return ctx;
}
