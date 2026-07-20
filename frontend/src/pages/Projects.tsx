import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { fetchProjects, createProject } from '../api/projects';
import type { CreateProjectData } from '../api/projects';
import { fetchOrganizations } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

const orgTypeColors: Record<string, string> = {
  CLIENT: 'bg-blue-100 text-blue-700',
  SI: 'bg-purple-100 text-purple-700',
  OEM: 'bg-amber-100 text-amber-700',
  SUPER_ADMIN: 'bg-gray-100 text-gray-600',
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

  const createMutation = useMutation({
    mutationFn: (data: CreateProjectData) => createProject(data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreate(false);
      setName('');
      setDescription('');
      setSelectedOrgIds([]);
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
    setSelectedOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId],
    );
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

    createMutation.mutate({
      name: trimmedName,
      description: description.trim() || undefined,
      organizationIds: selectedOrgIds,
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
        {isSuperAdmin && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {showCreate ? 'Cancel' : 'Create Project'}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">New Project</h3>
          {formError && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. NRB Bank CBS Upgrade"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organizations * (at least one of each type: Client, SI, OEM)
              </label>
              {clients.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-gray-500 mb-1">Client</p>
                  <div className="flex flex-wrap gap-2">
                    {clients.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => toggleOrg(org.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          selectedOrgIds.includes(org.id)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {org.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {sis.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-gray-500 mb-1">SI</p>
                  <div className="flex flex-wrap gap-2">
                    {sis.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => toggleOrg(org.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          selectedOrgIds.includes(org.id)
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                        }`}
                      >
                        {org.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {oems.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-gray-500 mb-1">OEM</p>
                  <div className="flex flex-wrap gap-2">
                    {oems.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => toggleOrg(org.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          selectedOrgIds.includes(org.id)
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400'
                        }`}
                      >
                        {org.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Project'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="h-4 w-1/2 rounded bg-gray-200" />
            <div className="h-4 w-2/3 rounded bg-gray-200" />
          </div>
        </div>
      )}

      {projects && projects.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No projects found.
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="space-y-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{project.name}</h3>
                  {project.description && (
                    <p className="mt-1 text-xs text-gray-500 truncate">{project.description}</p>
                  )}
                </div>
                <div className="ml-4 shrink-0 flex items-center gap-4 text-xs text-gray-500">
                  <span>{project._count.issues} issues</span>
                  <span>{project._count.users} users</span>
                  <span>{project.organizations.length} orgs</span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {project.organizations.map((po) => (
                  <span
                    key={po.id}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${orgTypeColors[po.organization.type] || 'bg-gray-100 text-gray-600'}`}
                  >
                    {po.organization.name}
                  </span>
                ))}
                {project.departments && project.departments.length > 0 && (
                  <>
                    <span className="text-gray-300">·</span>
                    {project.departments.map((pd) => (
                      <span
                        key={pd.id}
                        className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
                      >
                        {pd.department.name}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
