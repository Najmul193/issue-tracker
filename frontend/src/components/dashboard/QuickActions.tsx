import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function QuickActions() {
  const { user } = useAuth();
  if (!user) return null;

  const actions: { label: string; to: string; icon: string }[] = [];

  // All roles can create issues
  actions.push({ label: 'New Issue', to: '/issues/new', icon: '+' });

  if (user.role === 'SUPER_ADMIN') {
    actions.push({ label: 'Manage Users', to: '/users', icon: '' });
    actions.push({ label: 'Create Project', to: '/projects', icon: '' });
  } else if (user.role === 'ORG_ADMIN') {
    if (user.organization.type === 'SI') {
      actions.push({ label: 'Triage Queue', to: '/issues?status=NEW', icon: '' });
      actions.push({ label: 'SI Review', to: '/issues?status=SI_REVIEW', icon: '' });
    } else {
      actions.push({ label: 'My Org Issues', to: '/concern', icon: '' });
      actions.push({ label: 'Pending Approval', to: '/issues?status=PENDING_CLIENT_APPROVAL', icon: '' });
    }
    actions.push({ label: 'Manage Team', to: '/users', icon: '' });
  } else {
    // Regular USER
    actions.push({ label: 'My Assignments', to: '/concern?concernFilter=assigned', icon: '' });
    actions.push({ label: 'My Raised', to: '/concern?concernFilter=raised', icon: '' });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Link
          key={a.label}
          to={a.to}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          {a.icon && <span className="text-xs">{a.icon}</span>}
          {a.label}
        </Link>
      ))}
    </div>
  );
}
