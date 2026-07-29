import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Layers, UserCog, Trash2 } from 'lucide-react';
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
import { fetchUsers, fetchOrganizations, UserListItem } from '../api/users';
import type { UserOrg } from '../api/users';
import { ApiError } from '../api/client';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import AlertBanner from '../components/ui/AlertBanner';
import EmptyState from '../components/ui/EmptyState';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';

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

  const { data: orgs } = useQuery<UserOrg[]>({
    queryKey: ['orgs-list'],
    queryFn: fetchOrganizations,
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

  const handleCreateSubmit = (e: FormEvent) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setManagingDept(null);
      setSelectedUserId('');
    },
  });

  const removeManagerMutation = useMutation({
    mutationFn: (userId: string) => removeDepartmentManager(managingDept!.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      fetchDepartmentManagers(managingDept!.id).then(setManagers);
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
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-slate-700/60 dark:bg-slate-800">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-slate-100">Access Denied</h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-slate-400">
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
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">Departments</h1>
        <Button
          icon={<Plus />}
          onClick={() => {
            setFormName('');
            setFormOrgId(currentUser?.organizationId || '');
            setFormError('');
            setShowCreateModal(true);
          }}
        >
          Create Department
        </Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-10 rounded bg-neutral-200 dark:bg-slate-700" />
          <div className="h-10 rounded bg-neutral-200 dark:bg-slate-700" />
          <div className="h-10 rounded bg-neutral-200 dark:bg-slate-700" />
        </div>
      ) : !filteredDepartments || filteredDepartments.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white dark:border-slate-700/60 dark:bg-slate-800">
          <EmptyState icon={<Layers />} title="No departments found" />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <Thead>
                <tr>
                  <Th>Department</Th>
                  <Th>Organization</Th>
                  <Th>Managers</Th>
                  <Th>Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {filteredDepartments.map((dept) => (
                  <Tr key={dept.id}>
                    <Td className="whitespace-nowrap font-medium text-neutral-900 dark:text-slate-100">{dept.name}</Td>
                    <Td className="whitespace-nowrap">{dept.organization?.name || '—'}</Td>
                    <Td className="whitespace-nowrap">
                      {dept.managers && dept.managers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {dept.managers.map((m) => (
                            <span
                              key={m.userId}
                              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                            >
                              {m.user.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400 dark:text-slate-500">—</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openManageManagers(dept)}>
                          Manage Managers
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeletingDept(dept)}>
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {filteredDepartments.map((dept) => (
              <li key={dept.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-slate-700/60 dark:bg-slate-800">
                <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">{dept.name}</p>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-slate-400">{dept.organization?.name || '—'}</p>
                {dept.managers && dept.managers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {dept.managers.map((m) => (
                      <span
                        key={m.userId}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                      >
                        {m.user.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2 border-t border-neutral-100 pt-3 dark:border-slate-700/60">
                  <Button size="sm" variant="secondary" icon={<UserCog />} onClick={() => openManageManagers(dept)} className="flex-1">
                    Managers
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 />} onClick={() => setDeletingDept(dept)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Create Department Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Department"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" form="create-dept-form" isLoading={createMutation.isPending}>Create</Button>
          </div>
        }
      >
        <form id="create-dept-form" onSubmit={handleCreateSubmit} className="space-y-3">
          {formError && <AlertBanner tone="error">{formError}</AlertBanner>}
          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. IT, Finance, HR"
          />
          {isSuperAdmin && (
            <Select label="Organization" value={formOrgId} onChange={(e) => setFormOrgId(e.target.value)}>
              <option value="">Select organization</option>
              {(orgs || [])
                .filter((o) => o.type !== 'SUPER_ADMIN')
                .map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
            </Select>
          )}
        </form>
      </Modal>

      {/* Delete Department Confirmation */}
      <Modal
        isOpen={!!deletingDept}
        onClose={() => setDeletingDept(null)}
        title="Delete Department"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletingDept(null)}>Cancel</Button>
            <Button
              variant="danger"
              isLoading={deleteMutation.isPending}
              onClick={() => {
                if (!deletingDept) return;
                deleteMutation.mutate(deletingDept.id, { onSuccess: () => setDeletingDept(null) });
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        {deletingDept && (
          <p className="text-sm text-neutral-600 dark:text-slate-300">
            Are you sure you want to delete <strong>{deletingDept.name}</strong>?
            Issues assigned to this department will be reassigned to the organization queue.
          </p>
        )}
      </Modal>

      {/* Manage Managers Modal */}
      <Modal
        isOpen={!!managingDept}
        onClose={() => setManagingDept(null)}
        title={managingDept ? `Managers — ${managingDept.name}` : 'Managers'}
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setManagingDept(null)}>Close</Button>
          </div>
        }
      >
        <div className="mb-4 max-h-60 overflow-y-auto">
          {managers.length === 0 ? (
            <p className="text-sm text-neutral-400 dark:text-slate-500">No managers assigned.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-slate-700">
              {managers.map((m) => (
                <li key={m.userId} className="flex items-center justify-between py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex shrink-0 items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                      Manager
                    </span>
                    <span className="truncate text-sm font-medium text-neutral-900 dark:text-slate-100">{m.user.name}</span>
                    <span className="truncate text-xs text-neutral-400 dark:text-slate-500">{m.user.email}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    className="ml-2 shrink-0"
                    onClick={() => {
                      if (confirm(`Remove ${m.user.name} as manager?`)) {
                        removeManagerMutation.mutate(m.userId);
                      }
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-neutral-200 pt-3 dark:border-slate-700">
          <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-slate-400">Add Manager</p>
          {availableUsers && availableUsers.length > 0 ? (
            <div className="flex gap-2">
              <Select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="flex-1">
                <option value="">Select user...</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </Select>
              <Button
                disabled={!selectedUserId}
                isLoading={addManagerMutation.isPending}
                onClick={() => {
                  if (selectedUserId) addManagerMutation.mutate();
                }}
              >
                Add
              </Button>
            </div>
          ) : (
            <p className="text-xs text-neutral-400 dark:text-slate-500">
              {managers.length > 0
                ? 'All department users are already managers.'
                : 'No active users in this department yet.'}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
