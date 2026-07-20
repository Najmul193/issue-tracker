import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

const orgTypeColors: Record<string, string> = {
  CLIENT: 'bg-blue-100 text-blue-700',
  SI: 'bg-purple-100 text-purple-700',
  OEM: 'bg-amber-100 text-amber-700',
  SUPER_ADMIN: 'bg-gray-100 text-gray-600',
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
        <div className="h-6 w-48 rounded bg-gray-200" />
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-64 rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (!project) {
    return <div className="text-sm text-gray-500">Project not found.</div>;
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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{project.name}</h2>
          {project.description && (
            <p className="mt-1 text-sm text-gray-500">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{project._count.issues} issues</span>
          {isSuperAdmin && (
            <button
              onClick={() => {
                if (confirm('Delete this project? Issues will be unlinked.')) {
                  deleteMutation.mutate();
                }
              }}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('orgs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'orgs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Organizations ({projectOrgs?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Users ({projectUsers?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('depts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'depts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Departments ({projectDepts?.length || 0})
        </button>
      </div>

      {/* Organizations Tab */}
      {activeTab === 'orgs' && (
        <div>
          {isSuperAdmin && (
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => { setShowAddOrg(!showAddOrg); setError(null); }}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                {showAddOrg ? 'Cancel' : 'Add Organization'}
              </button>
            </div>
          )}

          {showAddOrg && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Select an organization to add:</p>
              <div className="flex flex-wrap gap-2">
                {availableOrgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => addOrgMutation.mutate(org.id)}
                    disabled={addOrgMutation.isPending}
                    className={`rounded-full px-3 py-1 text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:border-blue-400 disabled:opacity-50`}
                  >
                    {org.name} ({org.type})
                  </button>
                ))}
                {availableOrgs.length === 0 && (
                  <p className="text-xs text-gray-400">All organizations are already in this project.</p>
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white">
            {(projectOrgs || []).length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">No organizations in this project.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Type</th>
                    {isSuperAdmin && <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projectOrgs?.map((po) => (
                    <tr key={po.id}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{po.organization.name}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${orgTypeColors[po.organization.type] || ''}`}>
                          {po.organization.type}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${po.organization.name} from project? Their users will also be removed.`)) {
                                removeOrgMutation.mutate(po.organizationId);
                              }
                            }}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          {(isSuperAdmin || isOrgAdmin) && (
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => { setShowAddUser(!showAddUser); setError(null); }}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                {showAddUser ? 'Cancel' : 'Add User'}
              </button>
            </div>
          )}

          {showAddUser && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Select a user to add:</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {availableUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => addUserMutation.mutate(u.id)}
                    disabled={addUserMutation.isPending}
                    className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm hover:border-blue-400 disabled:opacity-50"
                  >
                    <span className="font-medium text-gray-900">{u.name}</span>
                    <span className="text-xs text-gray-500">{u.organization.name} — {roleLabels[u.role] || u.role}</span>
                  </button>
                ))}
                {availableUsers.length === 0 && (
                  <p className="text-xs text-gray-400">No more users available from member organizations.</p>
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white">
            {(projectUsers || []).length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">No users in this project.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Organization</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Department</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Role</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projectUsers?.map((pu) => (
                    <tr key={pu.id}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{pu.user.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{pu.user.email}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{pu.user.organization.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{pu.user.role === 'ORG_ADMIN' ? 'Admin Department' : (pu.user.department?.name || '—')}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{roleLabels[pu.user.role] || pu.user.role}</td>
                      {(isSuperAdmin || (isOrgAdmin && pu.user.organization.id === currentUser?.organizationId)) && (
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${pu.user.name} from project?`)) {
                                removeUserMutation.mutate(pu.userId);
                              }
                            }}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === 'depts' && (
        <div>
          {(isSuperAdmin || isOrgAdmin) && (
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => { setShowAddDept(!showAddDept); setError(null); }}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                {showAddDept ? 'Cancel' : 'Add Department'}
              </button>
            </div>
          )}

          {showAddDept && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Select a department to add:</p>
              <div className="flex flex-wrap gap-2">
                {availableDepts.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => addDeptMutation.mutate(d.id)}
                    disabled={addDeptMutation.isPending}
                    className="rounded-full px-3 py-1 text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:border-blue-400 disabled:opacity-50"
                  >
                    {d.name} ({d.organization?.name || 'Org'})
                  </button>
                ))}
                {availableDepts.length === 0 && (
                  <p className="text-xs text-gray-400">All available departments are already in this project.</p>
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white">
            {(projectDepts || []).length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">No departments in this project.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Department</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Organization</th>
                    {(isSuperAdmin || isOrgAdmin) && (
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projectDepts?.map((pd) => (
                    <tr key={pd.id}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{pd.department.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{pd.department.organization?.name || '—'}</td>
                      {(isSuperAdmin || isOrgAdmin) && (
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${pd.department.name} from project? Issues assigned to it will be reassigned to org queue.`)) {
                                removeDeptMutation.mutate(pd.departmentId);
                              }
                            }}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
