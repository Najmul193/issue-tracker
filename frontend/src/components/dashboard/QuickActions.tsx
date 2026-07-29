import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus,
  Users as UsersIcon,
  FolderPlus,
  Inbox,
  SearchCheck,
  Building2,
  Hourglass,
  UserCog,
  UserCheck,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { staggerContainer, staggerItem } from '../../lib/motion';

export default function QuickActions() {
  const { user } = useAuth();
  if (!user) return null;

  const actions: { label: string; to: string; icon: LucideIcon }[] = [];

  // All roles can create issues
  actions.push({ label: 'New Issue', to: '/issues/new', icon: Plus });

  if (user.role === 'SUPER_ADMIN') {
    actions.push({ label: 'Manage Users', to: '/users', icon: UsersIcon });
    actions.push({ label: 'Create Project', to: '/projects', icon: FolderPlus });
  } else if (user.role === 'ORG_ADMIN') {
    if (user.organization.type === 'SI') {
      actions.push({ label: 'Triage Queue', to: '/issues?status=NEW', icon: Inbox });
      actions.push({ label: 'SI Review', to: '/issues?status=SI_REVIEW', icon: SearchCheck });
    } else {
      actions.push({ label: 'My Org Issues', to: '/concern', icon: Building2 });
      actions.push({ label: 'Pending Approval', to: '/issues?status=PENDING_CLIENT_APPROVAL', icon: Hourglass });
    }
    actions.push({ label: 'Manage Team', to: '/users', icon: UserCog });
  } else {
    // Regular USER
    actions.push({ label: 'My Assignments', to: '/concern?concernFilter=assigned', icon: UserCheck });
    actions.push({ label: 'My Raised', to: '/concern?concernFilter=raised', icon: FileText });
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-wrap gap-2"
    >
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <motion.div key={a.label} variants={staggerItem}>
            <Link
              to={a.to}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
            >
              <Icon className="h-3.5 w-3.5" />
              {a.label}
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
