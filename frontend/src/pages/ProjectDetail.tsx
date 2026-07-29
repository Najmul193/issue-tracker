import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Trash2, Building2, Users as UsersIcon, Layers } from 'lucide-react';
import {
  fetchProject,
  fetchProjectUsers,
  fetchProjectOrganizations,
  fetchProjectDepartments,
  addOrganizationToProject,
  removeOrganizationFromProject,
  addDepartmentToProject,
  removeDepartmentFromProject,
  addUserToProject,
  removeUserFromProject,
  deleteProject,
} from '../api/projects';
import { fetchOrganizations, fetchUsers } from '../api/users';
import { fetchDepartments } from '../api/departments';
import type { UserOrg, UserListItem } from '../api/users';
import type { DepartmentWithOrg } from '../api/departments';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import AlertBanner from '../components/ui/AlertBanner';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';

const orgTypeColors: Record<string, string> = {
  CLIENT: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  SI: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
  OEM: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  SUPER_ADMIN: 'bg-neutral-100 text-neutral-600 dark:bg-slate-700 dark:text-slate-300',
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN: 'Org Admin',
  USER: 'User',
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'orgs' | 'users' | 'depts'>('orgs');
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddDept, setShowAddDept] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isOrgAdmin = currentUser?.role === 'ORG_ADMIN';

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });

  const { data: projectUsers } = useQuery({
    queryKey: ['project-users', id],
    queryFn: () => fetchProjectUsers(id!),
    enabled: !!id,
  });

  const { data: projectOrgs } = useQuery({
    queryKey: ['project-orgs', id],
    queryFn: () => fetchProjectOrganizations(id!),
    enabled: !!id,
  });

  const { data: projectDepts } = useQuery({
    queryKey: ['project-depts', id],
    queryFn: () => fetchProjectDepartments(id!),
    enabled: !!id,
  });

  const { data: allOrgs = [] as UserOrg[] } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
    enabled: showAddOrg && isSuperAdmin,
  });

  const { data: allDepts = [] as DepartmentWithOrg[] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    enabled: showAddDept && (isSuperAdmin || isOrgAdmin),
  });

  const { data: allUsers = [] as UserListItem[] } = useQuery({
    queryKey: ['project-addable-users', id],
    queryFn: fetchUsers,
    enabled: showAddUser && (isSuperAdmin || isOrgAdmin),
  });

  const addOrgMutation = useMutation({
    mutationFn: (orgId: string) => addOrganizationToProject(id!, orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-orgs', id] });
      setShowAddOrg(false);
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
    },
  });

  const removeOrgMutation = useMutation({
    mutationFn: (orgId: string) => removeOrganizationFromProject(id!, orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-orgs', id] });
      queryClient.invalidateQueries({ queryKey: ['project-users', id] });
      queryClient.invalidateQueries({ queryKey: ['project-depts', id] });
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
    },
  });

  const addDeptMutation = useMutation({
    mutationFn: (deptId: string) => addDepartmentToProject(id!, deptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-depts', id] });
      queryClient.invalidateQueries({ queryKey: ['project-users', id] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setShowAddDept(false);
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
    },
  });

  const removeDeptMutation = useMutation({
    mutationFn: (deptId: string) => removeDepartmentFromProject(id!, deptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-depts', id] });
      queryClient.invalidateQueries({ queryKey: ['project-users', id] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
    },
  });

  const addUserMutation = useMutation({
    mutationFn: (userId: string) => addUserToProject(id!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-users', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setShowAddUser(false);
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => removeUserFromProject(id!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-users', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-48 rounded bg-neutral-200 dark:bg-slate-700" />
        <div className="h-4 w-32 rounded bg-neutral-200 dark:bg-slate-700" />
        <div className="h-64 rounded-xl bg-neutral-100 dark:bg-slate-800" />
      </div>
    );
  }

  if (!project) {
    return <div className="text-sm text-neutral-500 dark:text-slate-400">Project not found.</div>;
  }

  const orgMemberIds = new Set((projectOrgs || []).map((po) => po.organizationId));
  const userMemberIds = new Set((projectUsers || []).map((pu) => pu.userId));

  const availableOrgs = (allOrgs || []).filter(
    (o) => !orgMemberIds.has(o.id) && o.type !== 'SUPER_ADMIN',
  );

  const memberOrgIds = new Set((projectOrgs || []).map((po) => po.organizationId));
  const availableUsers = (allUsers || []).filter(
    (u) =>
      !userMemberIds.has(u.id) &&
      memberOrgIds.has(u.organizationId) &&
      (isSuperAdmin || (isOrgAdmin && u.organizationId === currentUser?.organizationId)),
  );

  const projectDeptIds = new Set((projectDepts || []).map((pd) => pd.departmentId));
  const availableDepts = (allDepts || []).filter(
    (d) =>
      !projectDeptIds.has(d.id) &&
      memberOrgIds.has(d.organizationId) &&
      (isSuperAdmin || (isOrgAdmin && d.organizationId === currentUser?.organizationId)),
  );

  const tabs: { key: 'orgs' | 'users' | 'depts'; label: string; count: number }[] = [
    { key: 'orgs', label: 'Organizations', count: projectOrgs?.length || 0 },
    { key: 'users', label: 'Users', count: projectUsers?.length || 0 },
    { key: 'depts', label: 'Departments', count: projectDepts?.length || 0 },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">{project.name}</h2>
          {project.description && (
            <p className="mt-1 text-sm text-neutral-500 dark:text-slate-400">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500 dark:text-slate-400">{project._count.issues} issues</span>
          {isSuperAdmin && (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 />}
              onClick={() => {
                if (confirm('Delete this project? Issues will be unlinked.')) {
                  deleteMutation.mutate();
                }
              }}
              className="!bg-white !text-red-700 border !border-red-300 hover:!bg-red-50 dark:!bg-slate-800 dark:!text-red-400 dark:!border-red-500/30 dark:hover:!bg-red-500/10"
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3">
          <AlertBanner tone="error">
            {error}{' '}
            <button onClick={() => setError(null)} className="ml-1 underline">dismiss</button>
          </AlertBanner>
        </div>
      )}

      {/* Tabs */}
      <div className="scrollbar-thin mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Organizations Tab */}
      {activeTab === 'orgs' && (
        <div>
          {isSuperAdmin && (
            <div className="mb-3">
              <Button
                size="sm"
                variant={showAddOrg ? 'secondary' : 'primary'}
                icon={showAddOrg ? <X /> : <Plus />}
                onClick={() => { setShowAddOrg(!showAddOrg); setError(null); }}
              >
                {showAddOrg ? 'Cancel' : 'Add Organization'}
              </Button>
            </div>
          )}

          {showAddOrg && (
            <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
              <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-slate-400">Select an organization to add:</p>
              <div className="flex flex-wrap gap-2">
                {availableOrgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => addOrgMutation.mutate(org.id)}
                    disabled={addOrgMutation.isPending}
                    className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:border-brand-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {org.name} ({org.type})
                  </button>
                ))}
                {availableOrgs.length === 0 && (
                  <p className="text-xs text-neutral-400 dark:text-slate-500">All organizations are already in this project.</p>
                )}
              </div>
            </div>
          )}

          {(projectOrgs || []).length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white dark:border-slate-700/60 dark:bg-slate-800">
              <EmptyState icon={<Building2 />} title="No organizations in this project" />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <Thead>
                    <tr>
                      <Th>Name</Th>
                      <Th>Type</Th>
                      {isSuperAdmin && <Th className="text-right">Actions</Th>}
                    </tr>
                  </Thead>
                  <Tbody>
                    {projectOrgs?.map((po) => (
                      <Tr key={po.id}>
                        <Td className="font-medium text-neutral-900 dark:text-slate-100">{po.organization.name}</Td>
                        <Td>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${orgTypeColors[po.organization.type] || ''}`}>
                            {po.organization.type}
                          </span>
                        </Td>
                        {isSuperAdmin && (
                          <Td className="text-right">
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${po.organization.name} from project? Their users will also be removed.`)) {
                                  removeOrgMutation.mutate(po.organizationId);
                                }
                              }}
                              className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Remove
                            </button>
                          </Td>
                        )}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
              <ul className="space-y-2 md:hidden">
                {projectOrgs?.map((po) => (
                  <li key={po.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-slate-100">{po.organization.name}</p>
                      <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${orgTypeColors[po.organization.type] || ''}`}>
                        {po.organization.type}
                      </span>
                    </div>
                    {isSuperAdmin && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${po.organization.name} from project? Their users will also be removed.`)) {
                            removeOrgMutation.mutate(po.organizationId);
                          }
                        }}
                        className="shrink-0 rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          {(isSuperAdmin || isOrgAdmin) && (
            <div className="mb-3">
              <Button
                size="sm"
                variant={showAddUser ? 'secondary' : 'primary'}
                icon={showAddUser ? <X /> : <Plus />}
                onClick={() => { setShowAddUser(!showAddUser); setError(null); }}
              >
                {showAddUser ? 'Cancel' : 'Add User'}
              </Button>
            </div>
          )}

          {showAddUser && (
            <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
              <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-slate-400">Select a user to add:</p>
              <div className="scrollbar-thin max-h-48 space-y-1 overflow-y-auto">
                {availableUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => addUserMutation.mutate(u.id)}
                    disabled={addUserMutation.isPending}
                    className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm hover:border-brand-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60"
                  >
                    <span className="font-medium text-neutral-900 dark:text-slate-100">{u.name}</span>
                    <span className="text-xs text-neutral-500 dark:text-slate-400">{u.organization.name} — {roleLabels[u.role] || u.role}</span>
                  </button>
                ))}
                {availableUsers.length === 0 && (
                  <p className="text-xs text-neutral-400 dark:text-slate-500">No more users available from member organizations.</p>
                )}
              </div>
            </div>
          )}

          {(projectUsers || []).length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white dark:border-slate-700/60 dark:bg-slate-800">
              <EmptyState icon={<UsersIcon />} title="No users in this project" />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <Thead>
                    <tr>
                      <Th>Name</Th>
                      <Th>Email</Th>
                      <Th>Organization</Th>
                      <Th>Department</Th>
                      <Th>Role</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {projectUsers?.map((pu) => (
                      <Tr key={pu.id}>
                        <Td className="font-medium text-neutral-900 dark:text-slate-100">{pu.user.name}</Td>
                        <Td>{pu.user.email}</Td>
                        <Td>{pu.user.organization.name}</Td>
                        <Td>{pu.user.role === 'ORG_ADMIN' ? 'Admin' : (pu.user.department?.name || '—')}</Td>
                        <Td>{roleLabels[pu.user.role] || pu.user.role}</Td>
                        {(isSuperAdmin || (isOrgAdmin && pu.user.organization.id === currentUser?.organizationId)) ? (
                          <Td className="text-right">
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${pu.user.name} from project?`)) {
                                  removeUserMutation.mutate(pu.userId);
                                }
                              }}
                              className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Remove
                            </button>
                          </Td>
                        ) : (
                          <Td />
                        )}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
              <ul className="space-y-2 md:hidden">
                {projectUsers?.map((pu) => (
                  <li key={pu.id} className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900 dark:text-slate-100">{pu.user.name}</p>
                        <p className="truncate text-xs text-neutral-500 dark:text-slate-400">{pu.user.email}</p>
                      </div>
                      {(isSuperAdmin || (isOrgAdmin && pu.user.organization.id === currentUser?.organizationId)) && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${pu.user.name} from project?`)) {
                              removeUserMutation.mutate(pu.userId);
                            }
                          }}
                          className="shrink-0 rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-neutral-400 dark:text-slate-500">
                      {pu.user.organization.name} &middot; {roleLabels[pu.user.role] || pu.user.role}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === 'depts' && (
        <div>
          {(isSuperAdmin || isOrgAdmin) && (
            <div className="mb-3">
              <Button
                size="sm"
                variant={showAddDept ? 'secondary' : 'primary'}
                icon={showAddDept ? <X /> : <Plus />}
                onClick={() => { setShowAddDept(!showAddDept); setError(null); }}
              >
                {showAddDept ? 'Cancel' : 'Add Department'}
              </Button>
            </div>
          )}

          {showAddDept && (
            <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
              <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-slate-400">Select a department to add:</p>
              <div className="flex flex-wrap gap-2">
                {availableDepts.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => addDeptMutation.mutate(d.id)}
                    disabled={addDeptMutation.isPending}
                    className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:border-brand-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {d.name} ({d.organization?.name || 'Org'})
                  </button>
                ))}
                {availableDepts.length === 0 && (
                  <p className="text-xs text-neutral-400 dark:text-slate-500">All available departments are already in this project.</p>
                )}
              </div>
            </div>
          )}

          {(projectDepts || []).length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white dark:border-slate-700/60 dark:bg-slate-800">
              <EmptyState icon={<Layers />} title="No departments in this project" />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <Thead>
                    <tr>
                      <Th>Department</Th>
                      <Th>Organization</Th>
                      {(isSuperAdmin || isOrgAdmin) && <Th className="text-right">Actions</Th>}
                    </tr>
                  </Thead>
                  <Tbody>
                    {projectDepts?.map((pd) => (
                      <Tr key={pd.id}>
                        <Td className="font-medium text-neutral-900 dark:text-slate-100">{pd.department.name}</Td>
                        <Td>{pd.department.organization?.name || '—'}</Td>
                        {(isSuperAdmin || isOrgAdmin) && (
                          <Td className="text-right">
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${pd.department.name} from project? Issues assigned to it will be reassigned to org queue.`)) {
                                  removeDeptMutation.mutate(pd.departmentId);
                                }
                              }}
                              className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Remove
                            </button>
                          </Td>
                        )}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
              <ul className="space-y-2 md:hidden">
                {projectDepts?.map((pd) => (
                  <li key={pd.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-slate-100">{pd.department.name}</p>
                      <p className="truncate text-xs text-neutral-500 dark:text-slate-400">{pd.department.organization?.name || '—'}</p>
                    </div>
                    {(isSuperAdmin || isOrgAdmin) && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${pd.department.name} from project? Issues assigned to it will be reassigned to org queue.`)) {
                            removeDeptMutation.mutate(pd.departmentId);
                          }
                        }}
                        className="shrink-0 rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
