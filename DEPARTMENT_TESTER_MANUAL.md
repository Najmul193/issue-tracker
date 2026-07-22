# Department Management & Project Tagging — Tester Manual

**Quick reference for testing department features**

---

## Test Credentials

All passwords: `password123`

| Role | Email | Organization |
|------|-------|-------------|
| SUPER_ADMIN | superadmin@issuetracker.dev | Super Admin |
| ORG_ADMIN | bankadmin@issuetracker.dev | Bank |
| ORG_ADMIN | siadmin@issuetracker.dev | Data Edge |
| ORG_ADMIN | oracleadmin@issuetracker.dev | Oracle |
| USER | bankuser@issuetracker.dev | Bank |
| USER | siuser@issuetracker.dev | Data Edge |
| USER | oracleuser@issuetracker.dev | Oracle |

---

## 1. Department Management (Admins Only)

**URL:** `https://flexcube-tracker-frontend.onrender.com/departments`

### 1.1 Create Department

**As SUPER_ADMIN:**
1. Login as `superadmin@issuetracker.dev`
2. Navigate to **Departments** in sidebar
3. Click **Create Department**
4. Enter name (e.g., "QA")
5. Select organization from dropdown (Bank, Data Edge, Oracle, etc.)
6. Click **Create**
7. ✅ Department appears in list with correct organization

**As ORG_ADMIN:**
1. Login as `bankadmin@issuetracker.dev`
2. Navigate to **Departments**
3. Click **Create Department**
4. Enter name (e.g., "Support")
5. ✅ Organization dropdown is pre-selected (Bank) and cannot be changed
6. Click **Create**
7. ✅ Department created under Bank organization

**Validation Tests:**
- ✅ Empty name shows error: "Department name is required"
- ✅ No organization selected shows error: "Organization is required"

### 1.2 Delete Department

1. Login as admin
2. Navigate to **Departments**
3. Click **Delete** next to a department
4. Confirmation dialog: "Are you sure you want to delete [Dept Name]?"
5. Click **Delete**
6. ✅ Department removed from list
7. ✅ Users in deleted department lose their department assignment (shown as "—")

### 1.3 Manage Department Managers

1. Login as admin
2. Navigate to **Departments**
3. Click **Manage Managers** next to a department
4. **Add Manager:**
   - Select a user from dropdown (only shows users in that department)
   - Click **Add**
   - ✅ Manager appears in list with "Manager" badge
5. **Remove Manager:**
   - Click **Remove** next to a manager
   - Confirm removal
   - ✅ Manager removed from list

**Edge Cases:**
- ✅ Only active users in the department appear in dropdown
- ✅ Users already assigned as managers are excluded from dropdown
- ✅ "All department users are already managers" shown when all are managers
- ✅ "No active users in this department yet" shown when dept has no users

---

## 2. Project Department Tagging

### 2.1 Add Departments During Project Creation

**URL:** `https://flexcube-tracker-frontend.onrender.com/projects`

1. Login as `superadmin@issuetracker.dev`
2. Click **Create Project**
3. Enter project name (e.g., "Bank Core Banking Upgrade")
4. Select at least one organization of each type (Client, SI, OEM)
5. ✅ Departments appear under each selected organization
6. Click on department buttons to toggle selection (blue = selected)
7. Click **Create Project**
8. ✅ Project created with selected departments
9. ✅ Departments visible as green pills on project card

### 2.2 Add/Remove Departments from Existing Project

**URL:** `https://flexcube-tracker-frontend.onrender.com/projects/[id]`

1. Login as admin
2. Navigate to **Projects** and click on a project
3. Click **Departments** tab
4. **Add Department:**
   - Click **Add Department**
   - Select from available departments (only shows depts from member orgs)
   - ✅ Department added to list
5. **Remove Department:**
   - Click **Remove** next to a department
   - Confirm: "Remove [Dept Name] from project? Issues assigned to it will be reassigned to org queue."
   - ✅ Department removed from project

**Permission Rules:**
- ✅ SUPER_ADMIN can add/remove any department
- ✅ ORG_ADMIN can only add/remove departments from their own organization
- ✅ USER cannot access department management

---

## 3. Department Routing in Issue Assignment

### 3.1 Route Issue to Department

**Prerequisites:**
- Issue must be in a project
- Project must have departments tagged
- Departments must be from OTHER organizations (not raiser's org)

**Steps:**
1. Login as user (e.g., `bankuser@issuetracker.dev`)
2. Create or open an issue in a project
3. Click **Assign** button
4. Select **Route to dept** radio button
5. ✅ Only departments from other organizations appear in dropdown
6. Select a department (e.g., "Oracle (IT)")
7. Click **Assign**
8. ✅ Assignment shows: "Org Name (Dept Name)" e.g., "Oracle (IT)"
9. ✅ All ACTIVE members of that department receive in-app notifications
10. ✅ Department managers receive email notifications

### 3.2 Department Routing Edge Cases

**Visibility Rules:**
- ✅ "Route to dept" option only appears if issue has a project
- ✅ "Route to dept" option only appears if project has departments tagged
- ✅ Only departments from OTHER organizations are shown (not raiser's org)
- ✅ Departments from raiser's organization are hidden

**Assignment Display:**
- ✅ Department-routed issues show: "Org Name (Dept Name)"
- ✅ Example: "Oracle (IT)" when routed to Oracle's IT department

**Notification Rules:**
- ✅ All ACTIVE members of the routed department receive notifications
- ✅ Department managers receive email notifications
- ✅ Inactive users do not receive notifications

---

## 4. User Department Assignment

**URL:** `https://flexcube-tracker-frontend.onrender.com/users`

### 4.1 Assign Department When Creating User

1. Login as admin
2. Navigate to **Users**
3. Click **+ New User**
4. Fill in user details
5. Select department from dropdown
6. Click **Create**
7. ✅ User created with department assignment

### 4.2 Change User Department

1. Login as admin
2. Navigate to **Users**
3. Click **Edit** next to a user
4. Change department selection
5. Click **Save**
6. ✅ User's department updated

### 4.3 Department Column in Users Table

- ✅ ORG_ADMIN users show "Admin" instead of department name
- ✅ Regular users show their assigned department name
- ✅ Users without department show "—"

---

## 5. Complete Workflow Test

### End-to-End Scenario

1. **Create Department:**
   - Login as `superadmin@issuetracker.dev`
   - Create "Finance" department under "Oracle" organization

2. **Assign Users to Department:**
   - Login as `oracleadmin@issuetracker.dev`
   - Edit `oracleuser@issuetracker.dev` and assign to "Finance" department

3. **Add Department to Project:**
   - Login as `superadmin@issuetracker.dev`
   - Navigate to a project
   - Add "Finance" department to the project

4. **Create Issue:**
   - Login as `bankuser@issuetracker.dev`
   - Create an issue in the project

5. **Route to Department:**
   - Assign the issue to "Oracle (Finance)" department
   - ✅ All Finance members at Oracle receive notifications
   - ✅ Finance managers receive email

6. **Verify Assignment:**
   - ✅ Issue shows "Oracle (Finance)" as assignee
   - ✅ Department members can see the issue in their queue

---

## 6. API Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/departments` | GET | List departments (admin only) |
| `/api/departments` | POST | Create department (admin only) |
| `/api/departments/:id` | DELETE | Delete department (admin only) |
| `/api/departments/:id/managers` | GET | List department managers |
| `/api/departments/:id/managers` | POST | Add department manager |
| `/api/departments/:id/managers/:userId` | DELETE | Remove department manager |
| `/api/projects/:id/departments` | GET | List project departments |
| `/api/projects/:id/departments` | POST | Add department to project |
| `/api/projects/:id/departments/:deptId` | DELETE | Remove department from project |

---

## 7. Common Issues & Troubleshooting

| Issue | Solution |
|-------|----------|
| No departments appear in dropdown | Ensure departments are created and assigned to organizations |
| "Route to dept" option not visible | Check if issue has a project and project has departments tagged |
| Cannot add department to project | Verify you're SUPER_ADMIN or ORG_ADMIN of the department's org |
| Users not receiving notifications | Check if users are ACTIVE and in the department |
| Department shows "—" in users table | User hasn't been assigned to a department yet |

---

## 8. Quick Smoke Tests

**5-Minute Test:**
1. Login as `superadmin@issuetracker.dev`
2. Go to `/departments` → Create "Test Dept" under "Bank"
3. Go to `/projects` → Create project with Bank, Data Edge, Oracle
4. Add "Test Dept" to project
5. Login as `bankuser@issuetracker.dev`
6. Create issue → Assign → Route to dept → Select "Data Edge (IT)"
7. ✅ Issue shows "Data Edge (IT)" as assignee

**Permission Test:**
1. Login as `bankuser@issuetracker.dev`
2. Go to `/departments` → ✅ "Access Denied" message
3. Go to `/projects/[id]` → ✅ Cannot see "Add Department" button
4. Try to assign issue → ✅ "Route to dept" option available (if project has depts)

---

**Last Updated:** July 2026
