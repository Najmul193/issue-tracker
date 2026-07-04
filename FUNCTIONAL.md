# Functional Document — Issue Tracker

**Software by Data Edge Ltd**

---

## 1. User Categories & Login Credentials

There are three user roles with different permissions.

### Roles Overview

| Role | Permissions |
|------|-------------|
| **SUPER_ADMIN** | Full access — can view, create, assign, edit, delete any issue; manage all users across all organizations |
| **ORG_ADMIN** | Can view any issue; create, assign, and delete issues within own organization; manage USER accounts in own organization |
| **USER** | Can view any issue; create issues; change status on issues they are involved with; add comments and attachments |

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

The Dashboard shows key summary cards:

- **Total Open** — count of issues not in CLOSED or VERIFIED status
- **Overdue** — count of issues past their deadline
- **Critical** — count of CRITICAL priority issues
- **By Status** — bar chart showing issue counts per status
- **By Priority** — bar chart showing issue counts per priority

---

### 2.3 Viewing Issues

1. Click **Issues** in the sidebar.
2. The issue list shows: ID (truncated), title, type, priority, status, module, deadline, assigned to, and organization.
3. Filter issues using the buttons at the top:
   - **Type**: All / Bug / New Requirement / Change Request / Query
   - **Priority**: All / Critical / High / Medium / Low
   - **Status**: All / New / Acknowledged / Assigned / In Progress / Resolved / Verified / Closed / Reopened
   - **Overdue**: Toggle to show only overdue issues
   - **Module**: Type to search by module name
4. Navigate between pages using the pagination controls at the bottom.

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
   - **Metadata grid**: Raised By (name + org), Assigned To (user name or org queue), Deadline, Type
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
CLOSED → (no transitions, terminal state)
REOPENED → In Progress
```

**Who can change status?** Any user whose organization matches the issue's raised-by organization OR assigned-to organization, OR who is the assigned user. SUPER_ADMIN can change any issue.

---

### 2.7 Assigning / Reassigning an Issue

Only SUPER_ADMIN and ORG_ADMIN can assign issues.

1. On the Issue Detail page, under **Assign / Reassign**:
2. Select assignment target type:
   - **To user** — pick a user from the dropdown. ORG_ADMIN can only assign users within their own organization.
   - **To org** — assigns to the organization's queue (no specific user).
3. Click **Assign**.
4. A confirmation dialog appears. Review and confirm.
5. The issue is assigned. The status automatically changes to **ASSIGNED** if it was NEW or ACKNOWLEDGED.
6. The assignee receives a notification.

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
2. Select files (max 5 per upload, 15MB each, allowed types: images, PDFs, text, Word, Excel, ZIPs).
3. Files are uploaded and displayed in the **Attachments** section.
4. Click any attachment to download.

---

### 2.10 Deleting an Issue

Only SUPER_ADMIN and ORG_ADMIN can delete issues. ORG_ADMIN can only delete issues raised by their own organization.

1. On the Issue Detail page, click the **Delete** button in the top-right area (next to the title).
2. A confirmation dialog appears: *"Are you sure you want to delete this issue? This action cannot be undone."*
3. Click **OK** to confirm.
4. The issue is permanently deleted, and you are redirected to the Issues list.

---

### 2.11 Notifications

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

### 2.12 User Management (Admins Only)

#### SUPER_ADMIN

1. Click **Users** in the sidebar.
2. View all users across all organizations.
3. Filter by organization using the dropdown.
4. **Create User**: Click **+ New User**, fill in the form (name, email, phone, role, organization, password).
5. **Edit User**: Click the edit icon next to a user. Can change name, phone, and status (ACTIVE/INACTIVE).

#### ORG_ADMIN

1. Click **Users** in the sidebar.
2. Only sees users in their own organization.
3. **Create User**: Only can create USER role accounts in their own organization.
4. **Edit User**: Only can edit USER accounts in their own organization. Cannot change status.

#### USER

- The **Users** menu item is not visible. Navigating to `/users` shows "Access Denied".

---

### 2.13 Activity Log

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

## 3. Issue Workflow Example

### Complete Walkthrough: Bug Report → Fix → Close

1. **USER** logs in and creates a new BUG issue with CRITICAL priority.
2. **ORG_ADMIN** sees the issue in the list, views it, and assigns it to a developer.
3. The **assigned user** receives a notification, changes status to **In Progress**, works on the fix.
4. The developer changes status to **Resolved** with a resolution note.
5. **ORG_ADMIN** or the **reporter** verifies the fix and changes status to **Verified** → **Closed**.
6. If the bug reappears, someone can **Reopen** it (with a comment), and the cycle continues.

---

## 4. API Endpoints Reference

All endpoints are under the `/api` prefix.

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Login (rate-limited: 5 req/min) |
| POST | /auth/logout | Logout |
| GET | /auth/me | Get current user profile |
| GET | /health | Health check |
| GET | /dashboard/summary | Issue counts by status & priority |
| GET | /issues | List issues (filterable) |
| POST | /issues | Create issue |
| GET | /issues/:id | Get issue detail |
| PATCH | /issues/:id/assign | Assign/reassign issue |
| PATCH | /issues/:id/status | Update status |
| POST | /issues/:id/attachments | Upload attachments |
| POST | /issues/:id/comments | Add comment |
| GET | /issues/:id/activity | Get activity log |
| DELETE | /issues/:id | Delete issue (admins only) |
| GET | /users | List users (admins only) |
| POST | /users | Create user (admins only) |
| GET | /users/assignable | List assignable users |
| PATCH | /users/:id | Update user (admins only) |
| GET | /organizations | List organizations |
| GET | /notifications | List notifications |
| GET | /notifications/unread-count | Unread count |
| PATCH | /notifications/:id/read | Mark notification read |
| PATCH | /notifications/read-all | Mark all read |
| GET | /attachments/:id/download | Download attachment |

---

## 5. Deployment

- **Frontend**: https://flexcube-tracker-frontend.onrender.com
- **Backend**: Hosted on Render (no public URL)
- **Database**: PostgreSQL on Render
