// Single source of truth for brand + semantic colors.
// Imported by tailwind.config.js (Tailwind theme) and by src/lib/chartTheme.ts (Recharts),
// so badges, chart fills, and dashboard accents always stay in sync.

export const brand = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
  950: '#172554',
};

// IssueStatus, lowercased/underscored to be valid Tailwind color keys.
export const status = {
  new: '#0ea5e9',
  si_approval: '#6366f1',
  under_review: '#3b82f6',
  clarification_requested: '#f97316',
  assigned: '#8b5cf6',
  in_progress: '#a855f7',
  in_qa: '#f59e0b',
  si_review: '#eab308',
  pending_client_approval: '#14b8a6',
  closed: '#6b7280',
};

// IssuePriority
export const priority = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

// OrganizationType
export const orgType = {
  client: '#2563eb',
  si: '#6366f1',
  oem: '#7c3aed',
  super_admin: '#0f172a',
};

// NotificationType
export const notificationType = {
  assignment: '#2563eb',
  status_change: '#8b5cf6',
  deadline_warning: '#f59e0b',
  overdue: '#ef4444',
};

// IssueType
export const issueType = {
  bug: '#ef4444',
  new_requirement: '#3b82f6',
  change_request: '#f59e0b',
  query: '#8b5cf6',
};
