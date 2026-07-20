import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  fetchDepartments,
  createDepartment,
  deleteDepartment,
  fetchDepartmentManagers,
  addDepartmentManager,
  removeDepartmentManager,
  DepartmentWithOrg,
  DepartmentManager,
} from '../api/departments';
import { fetchUsers, UserListItem } from '../api/users';
import { ApiError } from '../api/client';

export default function Departments() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isOrgAdmin = currentUser?.role === 'ORG_ADMIN';
  const isAdmin = isSuperAdmin || isOrgAdmin;

  const { data: departments, isLoading } = useQuery<DepartmentWithOrg[]>({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    enabled: isAdmin,
  });

  const { data: users } = useQuery<UserListItem[]>({
    queryKey: ['users-list'],
    queryFn: fetchUsers,
    enabled: isAdmin,
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formOrgId, setFormOrgId] = useState('');
  const [formError, setFormError] = useState('');

  const [managingDept, setManagingDept] = useState<DepartmentWithOrg | null>(null);
  const [managers, setManagers] = useState<DepartmentManager[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  const createMutation = useMutation({
    mutationFn: () => createDepartment({ name: formName, organizationId: formOrgId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setShowCreateModal(false);
      setFormName('');
      setFormOrgId('');
      setFormError('');
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create department');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  const [deletingDept, setDeletingDept] = useState<DepartmentWithOrg | null>(null);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) {
      setFormError('Department name is required');
      return;
    }
    if (!formOrgId) {
      setFormError('Organization is required');
      return;
    }
    createMutation.mutate();
  };

  const openManageManagers = async (dept: DepartmentWithOrg) => {
    setManagingDept(dept);
    setSelectedUserId('');
    try {
      const data = await fetchDepartmentManagers(dept.id);
      setManagers(data);
    } catch {
      setManagers([]);
    }
  };

  const addManagerMutation = useMutation({
    mutationFn: () => addDepartmentManager(managingDept!.id, selectedUserId),
    onSuccess: async () => {
      const data = await fetchDepartmentManagers(managingDept!.id);
      setManagers(data);
      setSelectedUserId('');
    },
  });

  const removeManagerMutation = useMutation({
    mutationFn: (userId: string) => removeDepartmentManager(managingDept!.id, userId),
    onSuccess: async () => {
      const data = await fetchDepartmentManagers(managingDept!.id);
      setManagers(data);
    },
  });

  const orgUsers = users?.filter(
    (u) => u.departmentId === managingDept?.id && u.status === 'ACTIVE',
  );
  const availableUsers = orgUsers?.filter(
    (u) => !managers.some((m) => m.userId === u.id),
  );

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-sm text-gray-500">
          You need admin privileges to manage departments.
        </p>
      </div>
    );
  }

  const filteredDepartments = isSuperAdmin
    ? departments
    : departments?.filter((d) => d.organizationId === currentUser?.organizationId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
        <button
          onClick={() => {
            setFormName('');
            setFormOrgId(currentUser?.organizationId || '');
            setFormError('');
            setShowCreateModal(true);
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create Department
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-10 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-200" />
        </div>
      ) : !filteredDepartments || filteredDepartments.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          No departments found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Department
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Organization
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDepartments.map((dept) => (
                <tr key={dept.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {dept.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {dept.organization?.name || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openManageManagers(dept)}
                        className="rounded border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Manage Managers
                      </button>
                      <button
                        onClick={() => setDeletingDept(dept)}
                        className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12">
          <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Create Department</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              {formError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. IT, Finance, HR"
                />
              </div>
              {isSuperAdmin && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Organization
                  </label>
                  <select
                    value={formOrgId}
                    onChange={(e) => setFormOrgId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select organization</option>
                    {/* We'd need orgs list here; use a simple approach */}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingDept && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Delete Department</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{deletingDept.name}</strong>?
              Issues assigned to this department will be reassigned to the organization queue.
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setDeletingDept(null)}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteMutation.mutate(deletingDept.id, {
                    onSuccess: () => setDeletingDept(null),
                  });
                }}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {managingDept && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12">
          <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Managers — {managingDept.name}
            </h3>

            <div className="mb-4">
              {managers.length === 0 ? (
                <p className="text-sm text-gray-400">No managers assigned.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {managers.map((m) => (
                    <li key={m.userId} className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-700">
                        {m.user.name} ({m.user.email})
                      </span>
                      <button
                        onClick={() => removeManagerMutation.mutate(m.userId)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {availableUsers && availableUsers.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select user</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (selectedUserId) addManagerMutation.mutate();
                  }}
                  disabled={!selectedUserId || addManagerMutation.isPending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setManagingDept(null)}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
