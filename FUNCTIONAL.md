# Functional Document — Issue Tracker

**Software by Data Edge Ltd**

---

## 1. User Categories & Login Credentials

There are three user roles with different permissions.

### Roles Overview

| Role | Permissions |
|------|-------------|
| **SUPER_ADMIN** | Full access — can view, create, edit, delete any issue; manage all users and organizations across all tenants; create and manage projects |
| **ORG_ADMIN** | Can view any issue; create, assign (within own org), and delete issues within own organization; manage USER accounts in own organization |
| **USER** | Can view any issue; create issues; assign issues to users in **other** organizations (cross-org routing); change status on issues they are involved with; delete issues they created; add comments and attachments |

### Login URL

```
https://flexcube-tracker-frontend.onrender.com/login
```

### Test Credentials (all passwords: `password123`)

#### SUPER_ADMIN

| Name | Email | Organization |
|------|-------|-------------|
| Super Admin | superadmin@issuetracker.dev | Super Admin |

#### ORG_ADMIN

| Name | Email | Organization |
|------|-------|-------------|
| Bank Admin | bankadmin@issuetracker.dev | Bank |
| Data Edge Admin | siadmin@issuetracker.dev | Data Edge |
| Oracle Admin | oracleadmin@issuetracker.dev | Oracle |

#### USER

| Name | Email | Organization |
|------|-------|-------------|
| Super Viewer | superviewer@issuetracker.dev | Super Admin |
| Bank User | bankuser@issuetracker.dev | Bank |
| Data Edge User | siuser@issuetracker.dev | Data Edge |
| Oracle User | oracleuser@issuetracker.dev | Oracle |

---

## 2. Feature Walkthrough — Step by Step

### 2.1 Logging In

1. Navigate to the Login page.
2. Enter your email and password.
3. Click **Sign in**.
4. You are redirected to the **Dashboard**.

---

### 2.2 Dashboard

The Dashboard shows key summary cards and extended metrics:

**Summary Cards:**
- **Total Open** — count of issues not in CLOSED or VERIFIED status
- **Overdue** — count of issues past their deadline
- **Critical** — count of CRITICAL priority issues
- **Resolved This Month** — issues resolved/closed/verified in the current month

**Charts & Analytics:**
- **By Status** — bar chart showing issue counts per status
- **By Priority** — bar chart showing issue counts per priority
- **By Type** — breakdown of issues by type (Bug, New Requirement, Change Request, Query)
- **Trend (Last 30 Days)** — daily created vs resolved issue counts
- **Average Resolution Time** — average days from creation to resolution

**Personal & Team:**
- **My Assigned Issues** — top 5 open issues assigned to you, sorted by deadline
- **Recent Activity** — last 10 actions across visible issues
- **Org Comparison** (SUPER_ADMIN only) — open and overdue counts per organization

---

### 2.3 Viewing Issues

1. The sidebar has navigation items: **Dashboard**, **Concern**, **Issues**, **Projects**, **Notifications**, and **Users** (admins only). Projects is visible to all roles.
2. Click **Issues** in the sidebar to see all issues with full filter controls.
2. Click **Concern** in the sidebar to see only issues relevant to you:
   - **USER**: issues you raised or are assigned to you
   - **ORG_ADMIN / SUPER_ADMIN**: issues raised by anyone in your org, assigned to anyone in your org, or routed to your org queue
3. The Concern page has three sub-filters:
   - **All** (default) — raised + assigned + org-routed issues
   - **Raised** — only issues you or your org members created
   - **Assign** — only issues assigned to you or your org
4. The main Issues list shows: title, type, priority, status, module, deadline, assigned to, and organization.
5. Filter issues using the controls at the top:
   - **Type**: All / Bug / New Requirement / Change Request / Query
   - **Priority**: All / Critical / High / Medium / Low
   - **Status**: All / New / Acknowledged / Assigned / In Progress / Resolved / Verified / Closed / Reopened
   - **Overdue**: Toggle to show only overdue issues
   - **Module**: Type to search by module name
6. Navigate between pages using the pagination controls at the bottom.

---

### 2.4 Creating an Issue

All roles (SUPER_ADMIN, ORG_ADMIN, USER) can create issues.

1. Click **Issues** in the sidebar.
2. Click the **+ New Issue** button (top-right).
3. Fill in the form:
   - **Title** (required) — short summary of the issue
   - **Description** — detailed explanation
   - **Type** (required): Bug / New Requirement / Change Request / Query
   - **Priority** (required): Critical / High / Medium / Low
   - **Module** — optional name of the module/component
   - **Deadline** (required) — must be a future date. Defaults to:
     - Critical: 1 day from now
     - High: 3 days
     - Medium: 7 days
     - Low: 14 days
   - **Attachments** — drag & drop or click to upload files (max 5, up to 15MB each)
4. Click **Create Issue**.
5. You are redirected to the new issue's detail page.

---

### 2.5 Viewing Issue Details

1. From the Issues list, click on any issue title.
2. The Issue Detail page shows:
   - Title, priority badge, status badge, module tag
   - Issue ID and creation date
   - **Metadata grid**: Raised By (name + org), Assigned To (user name or org queue), Assigned By, Deadline, Type, Project
   - **Resolution Info** (when resolved): Resolution Note, Resolved By, Resolved At, Closed At
   - **Description** section
   - **Attachments** section — click to download files
   - **Status Change** control — buttons for allowed next statuses
   - **Assign / Reassign** control (admins only)
   - **Comments** section — add comments with file attachments
   - **Activity Log** — chronological history of all actions

---

### 2.6 Changing Issue Status

1. On the Issue Detail page, under **Update Status**, click the desired next status button (e.g., "Mark In Progress").
2. Some transitions require additional input:
   - **Reopened**: requires a comment explaining why
   - **Resolved**: requires a resolution note
3. Click **Confirm**.
4. The status is updated, a new activity log entry is created, and the assignee is notified.

#### Allowed Status Transitions

```
NEW → Acknowledged, Assigned
ACKNOWLEDGED → Assigned
ASSIGNED → In Progress
IN_PROGRESS → Resolved
RESOLVED → Verified, Reopened
VERIFIED → Closed, Reopened
CLOSED → Reopened         (raiser's org admin or SUPER_ADMIN only)
REOPENED → In Progress
```

**Who can change status?** Any user whose organization matches the issue's raised-by organization OR assigned-to organization, OR who is the assigned user. SUPER_ADMIN can change any issue.

**Special rules:**
- **Verify / Close**: Only the issue creator (raised-by user) or an ORG_ADMIN in the creator's organization can transition to VERIFIED or CLOSED. The resolver side (assigned user, assigned org) cannot verify or close.
- **Reopen a closed issue**: Only an ORG_ADMIN in the issue creator's organization or a SUPER_ADMIN can reopen a closed issue. Regular users and other org admins cannot.

---

### 2.7 Assigning / Reassigning an Issue

The assignment UI is available to all users on the Issue Detail page. Assignment rules vary by role and issue state.

#### Assignment Methods

- **To user** — pick a user from the dropdown
- **To org** — route to an organization's queue (org admin reassigns internally)
- Note: Reopened issues are auto-set to **ASSIGNED** on assignment

#### Who Can Assign to Whom

| Actor | Can assign to |
|-------|---------------|
| **SUPER_ADMIN** | Cannot assign issues (full access to create, edit, delete, and change status, but assignment is restricted to ORG_ADMIN and USER roles) |
| **ORG_ADMIN** | Users within their own org only; can route to any org |
| **USER** | Users in **other** organizations only (cross-org routing); can route to any org |

#### Cross-Org Type Restriction

When assigning to a different organization, the target organization cannot be of the same type as the actor's organization. For example, a user in a CLIENT org cannot assign to another CLIENT org — only to SI or OEM orgs.

#### Issue Detail View — Assignment Dropdown

The assignable users dropdown is context-aware:
- **SUPER_ADMIN**: returns no assignable users (cannot assign)
- **ORG_ADMIN with issue in their org queue**: sees only users within their own org
- **ORG_ADMIN who raised the issue but it's assigned elsewhere**: sees only users outside their own org
- **USER who is the current assignee**: sees only ORG_ADMINs in their own org (reroute to admin)
- **USER from raiser's org**: sees users from other organizations only (cross-org)
- When the issue belongs to a project, only users from project member organizations are shown

#### Assignee Reassignment (USER as current assignee)

If a USER is the current assignee of an issue, they can only reassign it to an **ORG_ADMIN** within their own organization (i.e., reroute to their admin). They cannot assign to another regular user or route to an org queue.

#### Org Queue Restriction

If an issue is currently routed to an organization queue (`assignedToOrgId` is set), any reassignment during the active lifecycle must stay within that org. The target user must belong to the same org, or the target org must match.

#### Reopened Issue Redistribution

After a closed issue is reopened by the raiser's ORG_ADMIN, that admin can assign the issue to users or orgs outside their own organization only. They cannot reassign it back to their own org.

#### Closed Issues

Closed issues cannot be assigned. The status must be changed to **REOPENED** first (by the raiser's org admin), after which assignment is available.

#### Confirmation & Notifications

1. Click **Assign** — a confirmation dialog appears.
2. Review the assignment details and click **Confirm**.
3. The assignee receives a notification and email.

---

### 2.8 Adding Comments

All roles can comment on any issue.

1. On the Issue Detail page, scroll to the **Comments** section.
2. Type your comment in the text area.
3. Optionally, attach files by clicking the paperclip icon or dragging files.
4. Click **Add Comment**.
5. The comment appears in the thread with your name, organization, and timestamp.

---

### 2.9 Uploading Attachments

All roles can upload attachments to any issue.

1. On the Issue Detail page or while creating an issue, click the upload area.
2. Select files (max 5 per upload, 15MB each, allowed types: JPEG, PNG, PDF, Word, Excel, CSV).
3. Files are uploaded and displayed in the **Attachments** section.
4. Click any attachment to download.

---

### 2.10 Projects (Admins Only)

Projects group issues by organizational membership and scope visibility.

1. Click **Projects** in the sidebar.
2. View all projects you have access to:
   - **SUPER_ADMIN**: sees all projects
   - **ORG_ADMIN**: sees projects where their organization is a member
   - **USER**: sees projects where they are a member
3. Click a project to view its details, member organizations, and member users.

#### Creating a Project (SUPER_ADMIN only)

1. Click **+ New Project** on the Projects page.
2. Enter a name and optional description.
3. Select at least one organization from each type (CLIENT, SI, OEM) — all three types are required.
4. All active users from selected organizations are automatically added as project members.
5. Click **Create**.

#### Managing Project Members

- **Add Organization**: SUPER_ADMIN can add organizations to a project. All active users from the added org are automatically included.
- **Remove Organization**: Removes the org and its users from the project. Issues assigned to the removed org's queue are unassigned.
- **Add User**: SUPER_ADMIN and ORG_ADMIN can add users (must belong to a project member org). ORG_ADMIN can only add users from their own org.
- **Remove User**: Removes the user from the project.

#### Project Scoping

- Issues can be linked to a project when created
- Issue visibility is scoped to project membership — non-members cannot see project-scoped issues
- Dashboard, notifications, and issue lists can be filtered by project

---

### 2.11 Deleting an Issue

The issue creator, an ORG_ADMIN of the creator's organization, or a SUPER_ADMIN can delete an issue.

1. On the Issue Detail page, click the **Delete** button in the top-right area (next to the title).
2. A confirmation dialog appears: *"Are you sure you want to delete this issue? This action cannot be undone."*
3. Click **OK** to confirm.
4. The issue is permanently deleted, and you are redirected to the Issues list.

---

### 2.12 Notifications

1. Click the notification bell icon in the top bar (shows unread count).
2. Click **Notifications** in the sidebar to view all notifications.
3. Filter: **All** or **Unread**.
4. Click **Mark as read** on individual notifications or **Mark all as read**.
5. Notifications are created for:
   - Issue assignment/reassignment
   - Status changes on issues you raised or are assigned to
   - Deadline approaching (warning at 80% time elapsed)
   - Deadline passed (overdue)

---

### 2.13 User Management (Admins Only)

#### SUPER_ADMIN

1. Click **Users** in the sidebar.
2. View all users across all organizations.
3. Filter by organization using the dropdown.
4. **Create User**: Click **+ New User**, fill in the form (name, email, phone, role, organization, password).
5. **Edit User**: Click the edit icon next to a user. Can change name, phone, and status (ACTIVE/INACTIVE).
6. **Delete User**: Click the Delete button next to a user. The user is soft-deleted (email/password cleared, status set to INACTIVE). The record is preserved for issue history.
7. **Delete Organization**: Below the user table, the **Organizations** section lists all organizations with a Delete button. Deleting an organization soft-deletes all its users and removes it from the active org list. The org record is preserved for historical issues.
8. **Silent Delete Section**: Below the Organizations section, a **Silent Delete** panel shows all soft-deleted users and organizations. Each item can be **permanently deleted**, which removes it from the database along with all related issues, comments, attachments, notifications, and activity logs.

#### ORG_ADMIN

1. Click **Users** in the sidebar.
2. Only sees users in their own organization.
3. **Create User**: Only can create USER role accounts in their own organization.
4. **Edit User**: Only can edit USER accounts in their own organization. Cannot change status.

#### USER

- The **Users** menu item is not visible. Navigating to `/users` shows "Access Denied".

---

### 2.14 Activity Log

Every action on an issue is recorded in the Activity Log, displayed chronologically at the bottom of the Issue Detail page.

| Action | Display |
|--------|---------|
| Issue created | "*Name* created issue" |
| Status changed | "*Name* changed status from **NEW** to **ASSIGNED**" |
| Issue assigned | "*Name* assigned issue to **Assignee Name**" |
| Issue reassigned | "*Name* reassigned from **Old Name** to **New Name**" |
| Comment added | "*Name* added a comment" |
| Attachment added | "*Name* uploaded **filename**" |

---

### 2.15 Password Reset

Users can reset their password via email.

1. On the Login page, click **Forgot Password**.
2. Enter your email address.
3. Click **Send Reset Link**. If the email is registered, a reset link is sent.
4. Check your email for the reset link (valid for 1 hour).
5. Click the link and enter a new password.
6. Click **Reset Password**. You can now log in with your new password.

**Note:** The system does not reveal whether an email address is registered (prevents email enumeration).

---

## 3. Issue Workflow Example

### Complete Walkthrough: Bug Report → Fix → Close

1. **USER** logs in and creates a new BUG issue with CRITICAL priority.
2. **ORG_ADMIN** sees the issue in the list, views it, and assigns it to a developer.
3. The **assigned user** receives a notification, changes status to **In Progress**, works on the fix.
4. The developer changes status to **Resolved** with a resolution note.
5. **The reporter** or **an ORG_ADMIN in the reporter's org** verifies the fix and changes status to **Verified** → **Closed**. (The developer who resolved the issue cannot verify or close it.)
6. If the bug reappears, someone can **Reopen** it (with a comment), and the cycle continues.

---

## 4. API Endpoints Reference

All endpoints are under the `/api` prefix.

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Login (rate-limited: 5 req/min) |
| POST | /auth/logout | Logout |
| GET | /auth/me | Get current user profile |
| POST | /auth/forgot-password | Request password reset (rate-limited: 3 req/min) |
| POST | /auth/reset-password | Reset password with token (rate-limited: 5 req/min) |
| GET | /health | Health check |
| GET | /dashboard/summary | Issue counts by status & priority |
| GET | /dashboard/metrics | Extended metrics (trends, resolution time, org comparison) |
| GET | /issues | List issues (filterable; supports `concern`, `concernFilter`, `projectId`, `projectIds` params) |
| POST | /issues | Create issue |
| GET | /issues/:id | Get issue detail |
| PATCH | /issues/:id/assign | Assign/reassign issue |
| PATCH | /issues/:id/status | Update status |
| POST | /issues/:id/attachments | Upload attachments |
| POST | /issues/:id/comments | Add comment |
| GET | /issues/:id/activity | Get activity log |
| DELETE | /issues/:id | Delete issue (creator, raiser's ORG_ADMIN, or SUPER_ADMIN) |
| GET | /users | List users (admins only) |
| POST | /users | Create user (admins only) |
| GET | /users/assignable | List assignable users |
| GET | /users/deleted | List soft-deleted users (SUPER_ADMIN only) |
| PATCH | /users/:id | Update user (admins only) |
| DELETE | /users/:id | Soft-delete user (admins only) |
| DELETE | /users/:id/permanent | Permanently delete user (SUPER_ADMIN only) |
| GET | /organizations | List active organizations |
| GET | /organizations/deleted | List soft-deleted organizations (SUPER_ADMIN only) |
| DELETE | /organizations/:id | Soft-delete organization (SUPER_ADMIN only) |
| DELETE | /organizations/:id/permanent | Permanently delete organization (SUPER_ADMIN only) |
| GET | /projects | List projects (scoped by role) |
| POST | /projects | Create project (SUPER_ADMIN only; requires CLIENT + SI + OEM orgs) |
| GET | /projects/:id | Get project detail |
| PATCH | /projects/:id | Update project (SUPER_ADMIN only) |
| DELETE | /projects/:id | Delete project (SUPER_ADMIN only) |
| GET | /projects/:id/organizations | List project organizations |
| POST | /projects/:id/organizations | Add organization to project (SUPER_ADMIN only) |
| DELETE | /projects/:id/organizations/:orgId | Remove organization from project (SUPER_ADMIN only) |
| GET | /projects/:id/users | List project users |
| POST | /projects/:id/users | Add user to project (SUPER_ADMIN / ORG_ADMIN for own org) |
| DELETE | /projects/:id/users/:userId | Remove user from project (SUPER_ADMIN / ORG_ADMIN for own org) |
| GET | /notifications | List notifications (supports `projectIds` filter) |
| GET | /notifications/unread-count | Unread count (supports `projectIds` filter) |
| PATCH | /notifications/:id/read | Mark notification read |
| PATCH | /notifications/read-all | Mark all read |
| GET | /attachments/:id/download | Download attachment |

---

## 5. Deployment

- **Frontend**: https://flexcube-tracker-frontend.onrender.com
- **Backend**: Hosted on Render (no public URL)
- **Database**: PostgreSQL on Render
