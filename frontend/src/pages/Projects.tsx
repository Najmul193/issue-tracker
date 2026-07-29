import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, X, FolderKanban, ListChecks, Users as UsersIcon, Building2 } from 'lucide-react';
import { fetchProjects, createProject } from '../api/projects';
import type { CreateProjectData } from '../api/projects';
import { fetchOrganizations } from '../api/users';
import { fetchDepartments } from '../api/departments';
import type { Department } from '../api/departments';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import AlertBanner from '../components/ui/AlertBanner';
import EmptyState from '../components/ui/EmptyState';
import { staggerContainer, staggerItem } from '../lib/motion';

const orgTypeColors: Record<string, string> = {
  CLIENT: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  SI: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
  OEM: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  SUPER_ADMIN: 'bg-neutral-100 text-neutral-600 dark:bg-slate-700 dark:text-slate-300',
};

const ORG_GROUP_TONE: Record<'CLIENT' | 'SI' | 'OEM', { selected: string; unselected: string; dept: string; deptOff: string }> = {
  CLIENT: {
    selected: 'bg-blue-600 text-white border-blue-600',
    unselected: 'bg-white text-neutral-700 border-neutral-300 hover:border-blue-400 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
    dept: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
    deptOff: 'bg-neutral-50 text-neutral-400 border-neutral-200 hover:border-blue-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-600',
  },
  SI: {
    selected: 'bg-purple-600 text-white border-purple-600',
    unselected: 'bg-white text-neutral-700 border-neutral-300 hover:border-purple-400 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
    dept: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30',
    deptOff: 'bg-neutral-50 text-neutral-400 border-neutral-200 hover:border-purple-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-600',
  },
  OEM: {
    selected: 'bg-amber-600 text-white border-amber-600',
    unselected: 'bg-white text-neutral-700 border-neutral-300 hover:border-amber-400 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
    dept: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
    deptOff: 'bg-neutral-50 text-neutral-400 border-neutral-200 hover:border-amber-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-600',
  },
};

export default function Projects() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const { data: allOrgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
    enabled: showCreate,
  });

  const { data: allDepts = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    enabled: showCreate,
  });

  const [selectedDeptIds, setSelectedDeptIds] = useState<Record<string, string[]>>({});

  const createMutation = useMutation({
    mutationFn: (data: CreateProjectData) => createProject(data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreate(false);
      setName('');
      setDescription('');
      setSelectedOrgIds([]);
      setSelectedDeptIds({});
      navigate(`/projects/${project.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('An unexpected error occurred');
      }
    },
  });

  const clients = (allOrgs || []).filter((o) => o.type === 'CLIENT');
  const sis = (allOrgs || []).filter((o) => o.type === 'SI');
  const oems = (allOrgs || []).filter((o) => o.type === 'OEM');

  function toggleOrg(orgId: string) {
    setSelectedOrgIds((prev) => {
      const next = prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId];
      return next;
    });
    setSelectedDeptIds((prev) => {
      const next = { ...prev };
      if (selectedOrgIds.includes(orgId)) {
        delete next[orgId];
      } else {
        const orgDepts = allDepts.filter((d) => d.organizationId === orgId);
        next[orgId] = orgDepts.map((d) => d.id);
      }
      return next;
    });
  }

  function toggleDept(orgId: string, deptId: string) {
    setSelectedDeptIds((prev) => {
      const current = prev[orgId] || [];
      const next = current.includes(deptId)
        ? current.filter((id) => id !== deptId)
        : [...current, deptId];
      return { ...prev, [orgId]: next };
    });
  }

  function handleCreate() {
    setFormError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Project name is required');
      return;
    }
    if (selectedOrgIds.length < 3) {
      setFormError('At least one organization of each type (Client, SI, OEM) is required');
      return;
    }
    const hasClient = selectedOrgIds.some((id) => clients.some((o) => o.id === id));
    const hasSi = selectedOrgIds.some((id) => sis.some((o) => o.id === id));
    const hasOem = selectedOrgIds.some((id) => oems.some((o) => o.id === id));
    if (!hasClient || !hasSi || !hasOem) {
      setFormError('At least one organization of each type (Client, SI, OEM) is required');
      return;
    }

    const allDeptIds = Object.values(selectedDeptIds).flat();

    createMutation.mutate({
      name: trimmedName,
      description: description.trim() || undefined,
      organizationIds: selectedOrgIds,
      departmentIds: allDeptIds.length > 0 ? allDeptIds : undefined,
    });
  }

  function OrgGroup({ label, orgs, tone }: { label: string; orgs: { id: string; name: string }[]; tone: 'CLIENT' | 'SI' | 'OEM' }) {
    if (orgs.length === 0) return null;
    const t = ORG_GROUP_TONE[tone];
    return (
      <div className="mb-3">
        <p className="mb-1 text-xs font-medium text-neutral-500 dark:text-slate-400">{label}</p>
        <div className="flex flex-wrap gap-2">
          {orgs.map((org) => (
            <div key={org.id} className="flex flex-col gap-1">
              <button
                onClick={() => toggleOrg(org.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedOrgIds.includes(org.id) ? t.selected : t.unselected
                }`}
              >
                {org.name}
              </button>
              {selectedOrgIds.includes(org.id) && allDepts.filter((d) => d.organizationId === org.id).length > 0 && (
                <div className="flex flex-wrap gap-1 pl-2">
                  {allDepts.filter((d) => d.organizationId === org.id).map((dept) => {
                    const isSelected = selectedDeptIds[org.id]?.includes(dept.id) ?? true;
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => toggleDept(org.id, dept.id)}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                          isSelected ? t.dept : t.deptOff
                        }`}
                      >
                        {dept.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">Projects</h2>
        {isSuperAdmin && (
          <Button
            variant={showCreate ? 'secondary' : 'primary'}
            icon={showCreate ? <X /> : <Plus />}
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? 'Cancel' : 'Create Project'}
          </Button>
        )}
      </div>

      {showCreate && (
        <Card className="mb-6" title="New Project">
          {formError && <AlertBanner tone="error">{formError}</AlertBanner>}
          <div className="space-y-4">
            <Input label="Name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NRB Bank CBS Upgrade" />
            <Textarea label="Description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-slate-300">
                Organizations * (at least one of each type: Client, SI, OEM)
              </label>
              <OrgGroup label="Client" orgs={clients} tone="CLIENT" />
              <OrgGroup label="SI" orgs={sis} tone="SI" />
              <OrgGroup label="OEM" orgs={oems} tone="OEM" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleCreate} isLoading={createMutation.isPending} className="px-5">
                Create Project
              </Button>
              <Button variant="secondary" onClick={() => setShowCreate(false)} className="px-5">
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-slate-700/60 dark:bg-slate-800">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-3/4 rounded bg-neutral-200 dark:bg-slate-700" />
            <div className="h-4 w-1/2 rounded bg-neutral-200 dark:bg-slate-700" />
            <div className="h-4 w-2/3 rounded bg-neutral-200 dark:bg-slate-700" />
          </div>
        </div>
      )}

      {projects && projects.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white dark:border-slate-700/60 dark:bg-slate-800">
          <EmptyState icon={<FolderKanban />} title="No projects found" />
        </div>
      )}

      {projects && projects.length > 0 && (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-3">
          {projects.map((project) => (
            <motion.div key={project.id} variants={staggerItem}>
              <Link
                to={`/projects/${project.id}`}
                className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover dark:border-slate-700/60 dark:bg-slate-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-slate-100">{project.name}</h3>
                    {project.description && (
                      <p className="mt-1 truncate text-xs text-neutral-500 dark:text-slate-400">{project.description}</p>
                    )}
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-3 text-xs text-neutral-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" />{project._count.issues}</span>
                    <span className="inline-flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" />{project._count.users}</span>
                    <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{project.organizations.length}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {project.organizations.map((po) => (
                    <span
                      key={po.id}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${orgTypeColors[po.organization.type] || 'bg-neutral-100 text-neutral-600 dark:bg-slate-700 dark:text-slate-300'}`}
                    >
                      {po.organization.name}
                    </span>
                  ))}
                  {project.departments && project.departments.length > 0 && (
                    <>
                      <span className="text-neutral-300 dark:text-slate-600">&middot;</span>
                      {project.departments.map((pd) => (
                        <span
                          key={pd.id}
                          className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-400"
                        >
                          {pd.department.name}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
