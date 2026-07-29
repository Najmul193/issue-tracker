import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, SquarePen, Trash2, ShieldCheck, UserCog, User as UserIcon, Building2 } from 'lucide-react';
import {
  fetchUsers, fetchOrganizations, createUser, updateUser, deleteUser, deleteOrganization,
  fetchDeletedUsers, fetchDeletedOrganizations, permanentDeleteUser, permanentDeleteOrganization,
} from '../api/users';
import type { UserListItem, CreateUserData, UpdateUserData, UserOrg, DeletedUser, DeletedOrg } from '../api/users';
import { fetchDepartments, createDepartment } from '../api/departments';
import type { DepartmentWithOrg } from '../api/departments';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import AlertBanner from '../components/ui/AlertBanner';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';

const ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'USER'] as const;
const NEW_ORG_VALUE = '__new__';

const ROLE_ICON: Record<string, typeof ShieldCheck> = {
  SUPER_ADMIN: ShieldCheck,
  ORG_ADMIN: UserCog,
  USER: UserIcon,
};

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
  const [formNewOrgType, setFormNewOrgType] = useState('CLIENT');
  const [formDepartmentId, setFormDepartmentId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [editDepartmentId, setEditDepartmentId] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Inline department creation state
  const [showNewDeptForm, setShowNewDeptForm] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptError, setNewDeptError] = useState('');
  const [newDeptTarget, setNewDeptTarget] = useState<'create' | 'edit'>('create');

  // Delete confirmation state
  const [deletingUser, setDeletingUser] = useState<UserListItem | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<UserOrg | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Silent delete section
  const [silentTab, setSilentTab] = useState<'users' | 'orgs'>('users');
  const [permanentDeletingUser, setPermanentDeletingUser] = useState<DeletedUser | null>(null);
  const [permanentDeletingOrg, setPermanentDeletingOrg] = useState<DeletedOrg | null>(null);
  const [permDeleteError, setPermDeleteError] = useState<string | null>(null);

  // Org filter for SUPER_ADMIN
  const [orgFilter, setOrgFilter] = useState('');

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isOrgAdmin = currentUser?.role === 'ORG_ADMIN';
  const isAdmin = isSuperAdmin || isOrgAdmin;

  const { data: users, isLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: fetchUsers,
  });

  const { data: orgs } = useQuery({
    queryKey: ['orgs-list'],
    queryFn: fetchOrganizations,
  });

  const { data: departments } = useQuery<DepartmentWithOrg[]>({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    enabled: isAdmin,
  });

  const { data: deletedUsers } = useQuery({
    queryKey: ['deleted-users'],
    queryFn: fetchDeletedUsers,
    enabled: isSuperAdmin,
  });

  const { data: deletedOrgs } = useQuery({
    queryKey: ['deleted-orgs'],
    queryFn: fetchDeletedOrganizations,
    enabled: isSuperAdmin,
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

  const permanentDeleteUserMutation = useMutation({
    mutationFn: (id: string) => permanentDeleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-users'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-orgs'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setPermanentDeletingUser(null);
      setPermDeleteError(null);
    },
    onError: (err) => {
      setPermDeleteError(err instanceof ApiError ? err.message : 'Failed to permanently delete user');
    },
  });

  const permanentDeleteOrgMutation = useMutation({
    mutationFn: (id: string) => permanentDeleteOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-users'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-orgs'] });
      queryClient.invalidateQueries({ queryKey: ['orgs-list'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setPermanentDeletingOrg(null);
      setPermDeleteError(null);
    },
    onError: (err) => {
      setPermDeleteError(err instanceof ApiError ? err.message : 'Failed to permanently delete organization');
    },
  });

  const createDeptMutation = useMutation({
    mutationFn: (data: { name: string; organizationId: string }) => createDepartment(data),
    onSuccess: (newDept) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      if (newDeptTarget === 'create') {
        setFormDepartmentId(newDept.id);
      } else {
        setEditDepartmentId(newDept.id);
      }
      setShowNewDeptForm(false);
      setNewDeptName('');
      setNewDeptError('');
    },
    onError: (err) => {
      setNewDeptError(err instanceof ApiError ? err.message : 'Failed to create department');
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
    setFormNewOrgType('CLIENT');
    setFormDepartmentId('');
    setFormError(null);
    setShowNewDeptForm(false);
    setNewDeptName('');
    setNewDeptError('');
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setFormError(null);
    setShowNewDeptForm(false);
    setNewDeptName('');
    setNewDeptError('');
  }

  function handleCreateSubmit(e: FormEvent) {
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
        departmentId: formDepartmentId || undefined,
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
      departmentId: formDepartmentId || undefined,
    });
  }

  function openEditModal(u: UserListItem) {
    setEditName(u.name);
    setEditPhone(u.phone || '');
    setEditStatus(u.status);
    setEditDepartmentId(u.departmentId || '');
    setEditError(null);
    setEditingUser(u);
    setShowNewDeptForm(false);
    setNewDeptName('');
    setNewDeptError('');
  }

  function closeEditModal() {
    setEditingUser(null);
    setEditError(null);
    setShowNewDeptForm(false);
    setNewDeptName('');
    setNewDeptError('');
  }

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);

    if (!editName.trim()) { setEditError('Name is required'); return; }

    updateMutation.mutate({
      id: editingUser.id,
      data: {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        departmentId: editDepartmentId || null,
        ...(currentUser?.role === 'SUPER_ADMIN' ? { status: editStatus } : {}),
      },
    });
  }

  // Route guard: USER role sees "not authorized"
  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-slate-700/60 dark:bg-slate-800">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-slate-100">Access Denied</h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-slate-400">
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
        <div className="h-6 w-48 rounded bg-neutral-200 dark:bg-slate-700" />
        <div className="h-8 w-full rounded bg-neutral-200 dark:bg-slate-700" />
        <div className="h-64 w-full rounded bg-neutral-200 dark:bg-slate-700" />
      </div>
    );
  }

  const deptFieldForCreate = (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400">Department</label>
      {!showNewDeptForm || newDeptTarget !== 'create' ? (
        <Select
          value={formDepartmentId}
          onChange={(e) => {
            if (e.target.value === '__new_dept__') {
              setShowNewDeptForm(true);
              setNewDeptTarget('create');
              setNewDeptName('');
              setNewDeptError('');
            } else {
              setFormDepartmentId(e.target.value);
            }
          }}
        >
          <option value="">None</option>
          {(departments || [])
            .filter((d) => (isSuperAdmin ? d.organizationId === formOrgId : d.organizationId === currentUser?.organizationId))
            .map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          <option value="__new_dept__">+ New Department</option>
        </Select>
      ) : (
        <div className="flex gap-2">
          <Input
            value={newDeptName}
            onChange={(e) => { setNewDeptName(e.target.value); setNewDeptError(''); }}
            placeholder="Department name"
            className="flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (newDeptName.trim()) {
                  const orgId = isSuperAdmin ? formOrgId : currentUser?.organizationId;
                  if (orgId) createDeptMutation.mutate({ name: newDeptName.trim(), organizationId: orgId });
                } else {
                  setNewDeptError('Department name is required');
                }
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            isLoading={createDeptMutation.isPending}
            disabled={!newDeptName.trim()}
            onClick={() => {
              if (newDeptName.trim()) {
                const orgId = isSuperAdmin ? formOrgId : currentUser?.organizationId;
                if (orgId) createDeptMutation.mutate({ name: newDeptName.trim(), organizationId: orgId });
              } else {
                setNewDeptError('Department name is required');
              }
            }}
          >
            Create
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => { setShowNewDeptForm(false); setNewDeptName(''); setNewDeptError(''); }}
          >
            Cancel
          </Button>
        </div>
      )}
      {newDeptError && newDeptTarget === 'create' && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{newDeptError}</p>}
    </div>
  );

  const deptFieldForEdit = (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400">Department</label>
      {!showNewDeptForm || newDeptTarget !== 'edit' ? (
        <Select
          value={editDepartmentId}
          onChange={(e) => {
            if (e.target.value === '__new_dept__') {
              setShowNewDeptForm(true);
              setNewDeptTarget('edit');
              setNewDeptName('');
              setNewDeptError('');
            } else {
              setEditDepartmentId(e.target.value);
            }
          }}
        >
          <option value="">None</option>
          {(departments || [])
            .filter((d) => d.organizationId === editingUser?.organizationId)
            .map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          <option value="__new_dept__">+ New Department</option>
        </Select>
      ) : (
        <div className="flex gap-2">
          <Input
            value={newDeptName}
            onChange={(e) => { setNewDeptName(e.target.value); setNewDeptError(''); }}
            placeholder="Department name"
            className="flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (newDeptName.trim() && editingUser) {
                  createDeptMutation.mutate({ name: newDeptName.trim(), organizationId: editingUser.organizationId });
                } else {
                  setNewDeptError('Department name is required');
                }
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            isLoading={createDeptMutation.isPending}
            disabled={!newDeptName.trim()}
            onClick={() => {
              if (newDeptName.trim() && editingUser) {
                createDeptMutation.mutate({ name: newDeptName.trim(), organizationId: editingUser.organizationId });
              } else {
                setNewDeptError('Department name is required');
              }
            }}
          >
            Create
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => { setShowNewDeptForm(false); setNewDeptName(''); setNewDeptError(''); }}
          >
            Cancel
          </Button>
        </div>
      )}
      {newDeptError && newDeptTarget === 'edit' && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{newDeptError}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">Users</h2>
        <Button icon={<Plus />} onClick={openCreateModal}>
          Create User
        </Button>
      </div>

      {/* Org filter for SUPER_ADMIN */}
      {isSuperAdmin && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-neutral-500 dark:text-slate-400">Organization</label>
          <Select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} className="max-w-xs">
            <option value="">All Organizations</option>
            {(orgs || []).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </Select>
        </div>
      )}

      {/* Users table — desktop */}
      <div className="hidden md:block">
        <Table>
          <Thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Organization</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th />
            </tr>
          </Thead>
          <Tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-neutral-400 dark:text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <Tr key={u.id}>
                  <Td className="whitespace-nowrap font-medium text-neutral-900 dark:text-slate-100">{u.name}</Td>
                  <Td className="whitespace-nowrap">{u.email}</Td>
                  <Td className="whitespace-nowrap">{u.role.replace('_', ' ')}</Td>
                  <Td className="whitespace-nowrap">{u.organization?.name || '—'}</Td>
                  <Td className="whitespace-nowrap">{u.role === 'ORG_ADMIN' ? 'Admin' : (u.department?.name || '—')}</Td>
                  <Td className="whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {u.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-neutral-500 dark:text-slate-400">
                    {u.createdAt ? formatDate(u.createdAt) : '—'}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit(u) && (
                        <button
                          onClick={() => openEditModal(u)}
                          aria-label="Edit user"
                          className="rounded-md p-1.5 text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                        >
                          <SquarePen className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete(u) && (
                        <button
                          onClick={() => { setDeletingUser(u); setDeleteError(null); }}
                          aria-label="Delete user"
                          className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </div>

      {/* Users list — mobile cards */}
      <ul className="space-y-3 md:hidden">
        {filteredUsers.length === 0 ? (
          <li className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-500">
            No users found.
          </li>
        ) : (
          filteredUsers.map((u) => {
            const RoleIcon = ROLE_ICON[u.role] ?? UserIcon;
            return (
              <li key={u.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-slate-700/60 dark:bg-slate-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-slate-100">{u.name}</p>
                    <p className="truncate text-xs text-neutral-500 dark:text-slate-400">{u.email}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                      : 'bg-neutral-100 text-neutral-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                    {u.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-slate-700 dark:text-slate-300">
                    <RoleIcon className="h-3 w-3" />
                    {u.role.replace('_', ' ')}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-slate-700 dark:text-slate-300">
                    <Building2 className="h-3 w-3" />
                    {u.organization?.name || '—'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2 dark:border-slate-700/60">
                  <span className="text-xs text-neutral-400 dark:text-slate-500">
                    {u.role === 'ORG_ADMIN' ? 'Admin' : (u.department?.name || 'No department')}
                  </span>
                  <div className="flex items-center gap-1">
                    {canEdit(u) && (
                      <button
                        onClick={() => openEditModal(u)}
                        aria-label="Edit user"
                        className="rounded-md p-1.5 text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                      >
                        <SquarePen className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete(u) && (
                      <button
                        onClick={() => { setDeletingUser(u); setDeleteError(null); }}
                        aria-label="Delete user"
                        className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create User"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeCreateModal}>Cancel</Button>
            <Button type="submit" form="create-user-form" isLoading={createMutation.isPending}>Create</Button>
          </div>
        }
      >
        <form id="create-user-form" onSubmit={handleCreateSubmit} className="space-y-3">
          {formError && <AlertBanner tone="error">{formError}</AlertBanner>}

          <Input label="Name *" value={formName} onChange={(e) => setFormName(e.target.value)} />
          <Input label="Email *" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
          <Input label="Password *" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
          <Input label="Phone" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />

          {isSuperAdmin && (
            <Select label="Role *" value={formRole} onChange={(e) => setFormRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </Select>
          )}

          {isOrgAdmin && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400">Role</label>
              <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                USER
              </p>
            </div>
          )}

          {isSuperAdmin && (
            <Select
              label="Organization *"
              value={formOrgId}
              onChange={(e) => {
                setFormOrgId(e.target.value);
                if (e.target.value !== NEW_ORG_VALUE) setFormNewOrgName('');
                setFormDepartmentId('');
                setShowNewDeptForm(false);
                setNewDeptName('');
                setNewDeptError('');
              }}
            >
              <option value="">Select organization...</option>
              {(orgs || []).map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
              <option value={NEW_ORG_VALUE}>+ New Organization</option>
            </Select>
          )}

          {isSuperAdmin && formOrgId === NEW_ORG_VALUE && (
            <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50 p-3 dark:border-brand-500/30 dark:bg-brand-500/10">
              <p className="text-xs font-medium text-brand-700 dark:text-brand-400">New Organization Details</p>
              <Input
                label="Organization Name *"
                value={formNewOrgName}
                onChange={(e) => setFormNewOrgName(e.target.value)}
                placeholder="e.g. Bank2"
              />
              <Select label="Organization Type *" value={formNewOrgType} onChange={(e) => setFormNewOrgType(e.target.value)}>
                <option value="CLIENT">CLIENT</option>
                <option value="SI">SI</option>
                <option value="OEM">OEM</option>
              </Select>
            </div>
          )}

          {isOrgAdmin && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400">Organization</label>
              <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                {currentUser?.organization?.name || 'Your organization'}
              </p>
            </div>
          )}

          {((isSuperAdmin && formOrgId && formOrgId !== NEW_ORG_VALUE) || isOrgAdmin) && deptFieldForCreate}
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={closeEditModal}
        title={editingUser ? `Edit User — ${editingUser.name}` : 'Edit User'}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeEditModal}>Cancel</Button>
            <Button type="submit" form="edit-user-form" isLoading={updateMutation.isPending}>Save</Button>
          </div>
        }
      >
        {editingUser && (
          <form id="edit-user-form" onSubmit={handleEditSubmit} className="space-y-3">
            {editError && <AlertBanner tone="error">{editError}</AlertBanner>}

            <Input label="Name *" value={editName} onChange={(e) => setEditName(e.target.value)} />

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400">Email</label>
              <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                {editingUser.email}
              </p>
            </div>

            <Input label="Phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />

            {(isSuperAdmin || isOrgAdmin) && deptFieldForEdit}

            {isSuperAdmin && (
              <div>
                <Select
                  label="Status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                  disabled={editingUser.id === currentUser!.id}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
                {editingUser.id === currentUser!.id && (
                  <p className="mt-1 text-xs text-neutral-400 dark:text-slate-500">You cannot deactivate your own account.</p>
                )}
              </div>
            )}

            {isOrgAdmin && (
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400">Status</label>
                <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                  {editingUser.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </p>
              </div>
            )}
          </form>
        )}
      </Modal>

      {/* Delete User Confirmation */}
      <Modal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        title="Delete User"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletingUser(null)}>Cancel</Button>
            <Button
              variant="danger"
              isLoading={deleteMutation.isPending}
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
            >
              Delete
            </Button>
          </div>
        }
      >
        {deleteError && <AlertBanner tone="error">{deleteError}</AlertBanner>}
        {deletingUser && (
          <p className="text-sm text-neutral-600 dark:text-slate-300">
            Are you sure you want to delete <strong>{deletingUser.name}</strong> ({deletingUser.email})?
            This will remove all their notifications, activity logs, comments, and attachments.
          </p>
        )}
      </Modal>

      {/* SUPER_ADMIN: Organization management */}
      {isSuperAdmin && (
        <Card title="Organizations">
          <div className="space-y-2">
            {(orgs || []).map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 dark:border-slate-700/60">
                <div>
                  <span className="text-sm font-medium text-neutral-900 dark:text-slate-100">{o.name}</span>
                  <span className="ml-2 text-xs text-neutral-400 dark:text-slate-500">{o.type}</span>
                </div>
                <button
                  onClick={() => { setDeletingOrg(o); setDeleteError(null); }}
                  className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Delete Organization Confirmation */}
      <Modal
        isOpen={!!deletingOrg}
        onClose={() => setDeletingOrg(null)}
        title="Delete Organization"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletingOrg(null)}>Cancel</Button>
            <Button
              variant="danger"
              isLoading={deleteOrgMutation.isPending}
              onClick={() => deletingOrg && deleteOrgMutation.mutate(deletingOrg.id)}
            >
              Delete
            </Button>
          </div>
        }
      >
        {deleteError && <AlertBanner tone="error">{deleteError}</AlertBanner>}
        {deletingOrg && (
          <p className="text-sm text-neutral-600 dark:text-slate-300">
            Are you sure you want to delete <strong>{deletingOrg.name}</strong>?
            This will permanently delete all users in this organization. Issues raised by this organization will be preserved.
          </p>
        )}
      </Modal>

      {/* Silent Delete Section */}
      {isSuperAdmin && (
        <Card title="Silent Delete">
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setSilentTab('users')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                silentTab === 'users'
                  ? 'bg-neutral-800 text-white dark:bg-slate-600'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              Deleted Users ({deletedUsers?.length || 0})
            </button>
            <button
              onClick={() => setSilentTab('orgs')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                silentTab === 'orgs'
                  ? 'bg-neutral-800 text-white dark:bg-slate-600'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              Deleted Orgs ({deletedOrgs?.length || 0})
            </button>
          </div>

          {silentTab === 'users' && (
            <Table>
              <Thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Org</Th>
                  <Th>Role</Th>
                  <Th>Deleted</Th>
                  <Th />
                </tr>
              </Thead>
              <Tbody>
                {(!deletedUsers || deletedUsers.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-xs text-neutral-400 dark:text-slate-500">
                      No softly deleted users.
                    </td>
                  </tr>
                ) : (
                  deletedUsers.map((u) => (
                    <Tr key={u.id}>
                      <Td className="whitespace-nowrap text-neutral-900 dark:text-slate-100">{u.name}</Td>
                      <Td className="whitespace-nowrap">{u.organization?.name || '—'}</Td>
                      <Td className="whitespace-nowrap">{u.role.replace('_', ' ')}</Td>
                      <Td className="whitespace-nowrap text-xs text-neutral-400 dark:text-slate-500">
                        {u.createdAt ? formatDate(u.createdAt) : '—'}
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        <button
                          onClick={() => { setPermanentDeletingUser(u); setPermDeleteError(null); }}
                          className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Permanently Delete
                        </button>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          )}

          {silentTab === 'orgs' && (
            <Table>
              <Thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Users</Th>
                  <Th />
                </tr>
              </Thead>
              <Tbody>
                {(!deletedOrgs || deletedOrgs.length === 0) ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-xs text-neutral-400 dark:text-slate-500">
                      No softly deleted organizations.
                    </td>
                  </tr>
                ) : (
                  deletedOrgs.map((o) => (
                    <Tr key={o.id}>
                      <Td className="whitespace-nowrap text-neutral-900 dark:text-slate-100">{o.name}</Td>
                      <Td className="whitespace-nowrap">{o.type}</Td>
                      <Td className="whitespace-nowrap">{o._count?.users ?? 0}</Td>
                      <Td className="whitespace-nowrap text-right">
                        <button
                          onClick={() => { setPermanentDeletingOrg(o); setPermDeleteError(null); }}
                          className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Permanently Delete
                        </button>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Permanent Delete User Confirmation */}
      <Modal
        isOpen={!!permanentDeletingUser}
        onClose={() => setPermanentDeletingUser(null)}
        title="Permanently Delete User"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPermanentDeletingUser(null)}>Cancel</Button>
            <Button
              variant="danger"
              isLoading={permanentDeleteUserMutation.isPending}
              onClick={() => permanentDeletingUser && permanentDeleteUserMutation.mutate(permanentDeletingUser.id)}
            >
              Permanently Delete
            </Button>
          </div>
        }
      >
        {permDeleteError && <AlertBanner tone="error">{permDeleteError}</AlertBanner>}
        {permanentDeletingUser && (
          <p className="text-sm text-neutral-600 dark:text-slate-300">
            Are you sure you want to permanently delete <strong>{permanentDeletingUser.name}</strong>?
            This will <strong>also delete all issues</strong> raised by this user. This action cannot be undone.
          </p>
        )}
      </Modal>

      {/* Permanent Delete Org Confirmation */}
      <Modal
        isOpen={!!permanentDeletingOrg}
        onClose={() => setPermanentDeletingOrg(null)}
        title="Permanently Delete Organization"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPermanentDeletingOrg(null)}>Cancel</Button>
            <Button
              variant="danger"
              isLoading={permanentDeleteOrgMutation.isPending}
              onClick={() => permanentDeletingOrg && permanentDeleteOrgMutation.mutate(permanentDeletingOrg.id)}
            >
              Permanently Delete
            </Button>
          </div>
        }
      >
        {permDeleteError && <AlertBanner tone="error">{permDeleteError}</AlertBanner>}
        {permanentDeletingOrg && (
          <p className="text-sm text-neutral-600 dark:text-slate-300">
            Are you sure you want to permanently delete <strong>{permanentDeletingOrg.name}</strong>?
            This will <strong>also delete all users and all issues</strong> in this organization.
            This action cannot be undone.
          </p>
        )}
      </Modal>
    </div>
  );
}
