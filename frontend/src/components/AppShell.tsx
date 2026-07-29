import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  Inbox,
  ListChecks,
  Bell,
  FolderKanban,
  Users as UsersIcon,
  Layers,
  LogOut,
  Menu,
  X,
  FolderOpen,
  ShieldCheck,
  UserCog,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProjectFilter } from '../context/ProjectFilterContext';
import NotificationBell from './NotificationBell';
import ProjectFilterDropdown from './ProjectFilterDropdown';
import ThemeToggle from './ThemeToggle';
import EmptyState from './ui/EmptyState';
import { drawerVariants, modalOverlay } from '../lib/motion';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Concern', path: '/concern', icon: Inbox },
  { label: 'Issues', path: '/issues', icon: ListChecks },
  { label: 'Notifications', path: '/notifications', icon: Bell },
];

const adminNavItem = { label: 'Users', path: '/users', icon: UsersIcon };
const superAdminNavItem = { label: 'Projects', path: '/projects', icon: FolderKanban };
const departmentsNavItem = { label: 'Departments', path: '/departments', icon: Layers };

const ROLE_META: Record<string, { label: string; icon: typeof User }> = {
  SUPER_ADMIN: { label: 'Super Admin', icon: ShieldCheck },
  ORG_ADMIN: { label: 'Org Admin', icon: UserCog },
  USER: { label: 'User', icon: User },
};

export default function AppShell() {
  const { user, logout, isLoading } = useAuth();
  const location = useLocation();
  const { hasProjects, isLoadingProjects } = useProjectFilter();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);

  const isAdmin = user?.role === 'ORG_ADMIN' || user?.role === 'SUPER_ADMIN';

  const items = [
    ...navItems,
    ...(isAdmin ? [adminNavItem, superAdminNavItem, departmentsNavItem] : []),
  ];

  function isActive(path: string) {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  }

  // Close mobile overlays on route change
  useEffect(() => {
    setDrawerOpen(false);
    setAccountSheetOpen(false);
  }, [location.pathname]);

  const showNoProjectsMessage = !isLoading && !isLoadingProjects && !hasProjects;
  const roleMeta = user ? ROLE_META[user.role] : undefined;
  const RoleIcon = roleMeta?.icon ?? User;

  function NavList({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'text-brand-700 dark:text-brand-400'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-active-pill"
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 rounded-lg bg-brand-50 dark:bg-brand-500/10"
                />
              )}
              <Icon className="relative h-4 w-4 shrink-0" />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-slate-900">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-slate-700/60 dark:bg-slate-800 lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-neutral-200 px-4 dark:border-slate-700/60">
          <img src="/logo.png" alt="Data Edge Ltd" className="h-9 w-auto" />
          <h1 className="text-base font-bold text-neutral-900 dark:text-slate-100">Issue Tracker</h1>
        </div>
        <NavList />
        <div className="border-t border-neutral-200 px-4 py-3 dark:border-slate-700/60">
          <p className="text-xs text-neutral-400 dark:text-slate-500">
            Powered by <span className="font-medium text-neutral-500 dark:text-slate-400">Data Edge Ltd</span>
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="lg:hidden">
            <motion.div
              variants={modalOverlay}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-40 bg-neutral-900/50 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              variants={drawerVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-modal dark:bg-slate-800"
            >
              <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-4 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="Data Edge Ltd" className="h-8 w-auto" />
                  <h1 className="text-base font-bold text-neutral-900 dark:text-slate-100">Issue Tracker</h1>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 dark:text-slate-500 dark:hover:bg-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavList onNavigate={() => setDrawerOpen(false)} />
              <div
                className="border-t border-neutral-200 px-4 py-3 dark:border-slate-700/60"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
              >
                <button
                  onClick={logout}
                  className="flex w-full min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-slate-700/60 dark:bg-slate-800 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="-ml-1 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-700 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            {!isLoading && user && (
              <div className="hidden items-center gap-3 sm:flex">
                <span className="text-sm font-medium text-neutral-900 dark:text-slate-100">{user.name}</span>
                <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                  {user.organization.name}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium uppercase text-neutral-600 dark:bg-slate-700 dark:text-slate-300">
                  <RoleIcon className="h-3 w-3" />
                  {roleMeta?.label ?? user.role}
                </span>
              </div>
            )}
          </div>

          {/* Desktop controls */}
          <div className="hidden items-center gap-1 sm:flex">
            <ProjectFilterDropdown />
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={logout}
              className="ml-1 rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            >
              Logout
            </button>
          </div>

          {/* Mobile controls */}
          <div className="flex items-center gap-1 sm:hidden">
            <NotificationBell />
            <button
              onClick={() => setAccountSheetOpen(true)}
              aria-label="Account menu"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-400"
            >
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="scrollbar-thin flex-1 overflow-y-auto p-4 sm:p-6">
          {showNoProjectsMessage ? (
            <EmptyState
              icon={<FolderOpen />}
              title="No Projects Assigned"
              description="You are not assigned to any project. Please contact your administrator to get access."
            />
          ) : (
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          )}
        </main>
      </div>

      {/* Mobile account sheet */}
      <AnimatePresence>
        {accountSheetOpen && (
          <div className="sm:hidden">
            <motion.div
              variants={modalOverlay}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-40 bg-neutral-900/50 backdrop-blur-sm"
              onClick={() => setAccountSheetOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-modal dark:bg-slate-800"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-200 dark:bg-slate-600" />
              {user && (
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-base font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-400">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900 dark:text-slate-100">{user.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                        {user.organization.name}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium uppercase text-neutral-600 dark:bg-slate-700 dark:text-slate-300">
                        <RoleIcon className="h-3 w-3" />
                        {roleMeta?.label ?? user.role}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <ProjectFilterDropdown variant="inline" />
              </div>

              <div className="mb-4 flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 dark:border-slate-700">
                <span className="text-sm font-medium text-neutral-700 dark:text-slate-200">Appearance</span>
                <ThemeToggle />
              </div>

              <button
                onClick={logout}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 dark:bg-slate-700 dark:text-slate-200"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
