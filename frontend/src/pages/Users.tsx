import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, fetchOrganizations, createUser, updateUser, deleteUser, deleteOrganization } from '../api/users';
import type { UserListItem, CreateUserData, UpdateUserData, UserOrg } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

const ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'USER'] as const;
const NEW_ORG_VALUE = '__new__';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('USER');
  const [formOrgId, setFormOrgId] = useState('');
  const [formNewOrgName, setFormNewOrgName] = useState('');
  const [formNewOrgType, setFormNewOrgType] = useState('BANK');
  const [formError, setFormError] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation state
  const [deletingUser, setDeletingUser] = useState<UserListItem | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<UserOrg | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Org filter for SUPER_ADMIN
  const [orgFilter, setOrgFilter] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: fetchUsers,
  });

  const { data: orgs } = useQuery({
    queryKey: ['orgs-list'],
    queryFn: fetchOrganizations,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserData) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      queryClient.invalidateQueries({ queryKey: ['orgs-list'] });
      closeCreateModal();
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserData }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setEditingUser(null);
      setEditError(null);
    },
    onError: (err) => {
      setEditError(err instanceof ApiError ? err.message : 'Failed to update user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setDeletingUser(null);
      setDeleteError(null);
    },
    onError: (err) => {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete user');
    },
  });

  const deleteOrgMutation = useMutation({
    mutationFn: (id: string) => deleteOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      queryClient.invalidateQueries({ queryKey: ['orgs-list'] });
      setDeletingOrg(null);
      setDeleteError(null);
    },
    onError: (err) => {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete organization');
    },
  });

  function openCreateModal() {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormPhone('');
    setFormRole('USER');
    setFormOrgId(currentUser?.organizationId || '');
    setFormNewOrgName('');
    setFormNewOrgType('BANK');
    setFormError(null);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setFormError(null);
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) { setFormError('Name is required'); return; }
    if (!formEmail.trim()) { setFormError('Email is required'); return; }
    if (!validateEmail(formEmail.trim())) { setFormError('Invalid email format'); return; }
    if (!formPassword.trim()) { setFormError('Password is required'); return; }
    if (formPassword.length < 6) { setFormError('Password must be at least 6 characters'); return; }

    if (currentUser?.role === 'ORG_ADMIN') {
      createMutation.mutate({
        name: formName.trim(),
        email: formEmail.trim(),
        password: formPassword,
        phone: formPhone.trim() || undefined,
        role: 'USER',
        organizationId: currentUser.organizationId,
      });
      return;
    }

    if (formOrgId === NEW_ORG_VALUE) {
      if (!formNewOrgName.trim()) { setFormError('Organization name is required'); return; }
      createMutation.mutate({
        name: formName.trim(),
        email: formEmail.trim(),
        password: formPassword,
        phone: formPhone.trim() || undefined,
        role: formRole,
        newOrganizationName: formNewOrgName.trim(),
        newOrganizationType: formNewOrgType,
      });
      return;
    }

    if (!formOrgId) { setFormError('Organization is required'); return; }

    createMutation.mutate({
      name: formName.trim(),
      email: formEmail.trim(),
      password: formPassword,
      phone: formPhone.trim() || undefined,
      role: formRole,
      organizationId: formOrgId,
    });
  }

  function openEditModal(u: UserListItem) {
    setEditName(u.name);
    setEditPhone(u.phone || '');
    setEditStatus(u.status);
    setEditError(null);
    setEditingUser(u);
  }

  function closeEditModal() {
    setEditingUser(null);
    setEditError(null);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);

    if (!editName.trim()) { setEditError('Name is required'); return; }

    updateMutation.mutate({
      id: editingUser.id,
      data: {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        ...(currentUser?.role === 'SUPER_ADMIN' ? { status: editStatus } : {}),
      },
    });
  }

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isOrgAdmin = currentUser?.role === 'ORG_ADMIN';
  const isAdmin = isSuperAdmin || isOrgAdmin;

  // Route guard: USER role sees "not authorized"
  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-sm text-gray-500">
          You do not have permission to access the Users page.
        </p>
      </div>
    );
  }

  // Determine if current user can edit a given target user
  function canEdit(target: UserListItem): boolean {
    if (isSuperAdmin) return true;
    if (isOrgAdmin) {
      return target.role === 'USER' && target.organizationId === currentUser!.organizationId;
    }
    return false;
  }

  function canDelete(target: UserListItem): boolean {
    if (target.role === 'SUPER_ADMIN') return false;
    if (isSuperAdmin) return true;
    if (isOrgAdmin) {
      return target.role === 'USER' && target.organizationId === currentUser!.organizationId;
    }
    return false;
  }

  const filteredUsers = (users || []).filter((u) => {
    if (isSuperAdmin && orgFilter) {
      return u.organizationId === orgFilter;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-48 rounded bg-gray-200" />
        <div className="h-8 w-full rounded bg-gray-200" />
        <div className="h-64 w-full rounded bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Users</h2>
        <button
          onClick={openCreateModal}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create User
        </button>
      </div>

      {/* Org filter for SUPER_ADMIN */}
      {isSuperAdmin && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Organization</label>
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Organizations</option>
            {(orgs || []).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Users table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Organization</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{u.email}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{u.role.replace('_', ' ')}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{u.organization?.name || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {u.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {u.createdAt ? formatDate(u.createdAt) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {canEdit(u) && (
                      <button
                        onClick={() => openEditModal(u)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete(u) && (
                      <button
                        onClick={() => { setDeletingUser(u); setDeleteError(null); }}
                        className="ml-3 text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12">
          <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Create User</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              {formError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              )}

              {isOrgAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                  <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500">
                    USER
                  </p>
                </div>
              )}

              {isSuperAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Organization *</label>
                  <select
                    value={formOrgId}
                    onChange={(e) => {
                      setFormOrgId(e.target.value);
                      if (e.target.value !== NEW_ORG_VALUE) setFormNewOrgName('');
                    }}
                    className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select organization...</option>
                    {(orgs || []).map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                    <option value={NEW_ORG_VALUE}>+ New Organization</option>
                  </select>
                </div>
              )}

              {isSuperAdmin && formOrgId === NEW_ORG_VALUE && (
                <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs font-medium text-blue-700">New Organization Details</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Organization Name *</label>
                    <input
                      type="text"
                      value={formNewOrgName}
                      onChange={(e) => setFormNewOrgName(e.target.value)}
                      placeholder="e.g. Bank2"
                      className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Organization Type *</label>
                    <select
                      value={formNewOrgType}
                      onChange={(e) => setFormNewOrgType(e.target.value)}
                      className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="BANK">BANK</option>
                      <option value="SI">SI</option>
                      <option value="ORACLE">ORACLE</option>
                    </select>
                  </div>
                </div>
              )}

              {isOrgAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Organization</label>
                  <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500">
                    {currentUser?.organization?.name || 'Your organization'}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12">
          <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Edit User — {editingUser.name}
            </h3>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              {editError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500">
                  {editingUser.email}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    disabled={editingUser.id === currentUser!.id}
                    className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                  {editingUser.id === currentUser!.id && (
                    <p className="mt-1 text-xs text-gray-400">You cannot deactivate your own account.</p>
                  )}
                </div>
              )}

              {isOrgAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500">
                    {editingUser.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Delete User</h3>
            {deleteError && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {deleteError}
              </div>
            )}
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{deletingUser.name}</strong> ({deletingUser.email})?
              This will remove all their notifications, activity logs, comments, and attachments.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingUser.id)}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPER_ADMIN: Organization management */}
      {isSuperAdmin && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Organizations
          </h3>
          <div className="space-y-2">
            {(orgs || []).map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-gray-900">{o.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{o.type}</span>
                </div>
                <button
                  onClick={() => { setDeletingOrg(o); setDeleteError(null); }}
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Organization Confirmation */}
      {deletingOrg && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Delete Organization</h3>
            {deleteError && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {deleteError}
              </div>
            )}
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{deletingOrg.name}</strong>?
              This will permanently delete all users in this organization. Issues raised by this organization will be preserved.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeletingOrg(null)}
                className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteOrgMutation.mutate(deletingOrg.id)}
                disabled={deleteOrgMutation.isPending}
                className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteOrgMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
