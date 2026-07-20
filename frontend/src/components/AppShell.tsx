import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProjectFilter } from '../context/ProjectFilterContext';
import NotificationBell from './NotificationBell';
import ProjectFilterDropdown from './ProjectFilterDropdown';

const navItems = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Concern', path: '/concern' },
  { label: 'Issues', path: '/issues' },
  { label: 'Notifications', path: '/notifications' },
];

const superAdminNavItem = { label: 'Projects', path: '/projects' };
const adminNavItem = { label: 'Users', path: '/users' };
const departmentsNavItem = { label: 'Departments', path: '/departments' };

export default function AppShell() {
  const { user, logout, isLoading } = useAuth();
  const location = useLocation();
  const { hasProjects, isLoadingProjects } = useProjectFilter();

  const isAdmin =
    user?.role === 'ORG_ADMIN' || user?.role === 'SUPER_ADMIN';

  function isActive(path: string) {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  }

  const showNoProjectsMessage = !isLoading && !isLoadingProjects && !hasProjects;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-gray-200 bg-white">
        <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-4">
          <img src="/logo.png" alt="Data Edge Ltd" className="h-10 w-auto" />
          <h1 className="text-lg font-bold text-gray-900">Issue Tracker</h1>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              key={adminNavItem.path}
              to={adminNavItem.path}
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(adminNavItem.path)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {adminNavItem.label}
            </Link>
          )}
          {isAdmin && (
            <Link
              key={superAdminNavItem.path}
              to={superAdminNavItem.path}
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(superAdminNavItem.path)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {superAdminNavItem.label}
            </Link>
          )}
          {isAdmin && (
            <Link
              key={departmentsNavItem.path}
              to={departmentsNavItem.path}
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(departmentsNavItem.path)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {departmentsNavItem.label}
            </Link>
          )}
        </nav>
        <div className="border-t border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">
            Powered by <span className="font-medium text-gray-500">Data Edge Ltd</span>
          </p>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
          <div className="flex items-center gap-3">
            {!isLoading && user && (
              <>
                <span className="text-sm font-medium text-gray-900">
                  {user.name}
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {user.organization.name}
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 uppercase">
                  {user.role === 'SUPER_ADMIN'
                    ? 'Super Admin'
                    : user.role === 'ORG_ADMIN'
                      ? 'Org Admin'
                      : 'User'}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ProjectFilterDropdown />
            <NotificationBell />
            <button
              onClick={logout}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {showNoProjectsMessage ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <svg className="mb-4 h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-700">No Projects Assigned</h2>
              <p className="mt-2 max-w-sm text-sm text-gray-500">
                You are not assigned to any project. Please contact your administrator to get access.
              </p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
