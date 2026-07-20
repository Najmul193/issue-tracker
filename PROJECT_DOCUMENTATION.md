# Issue Tracker — Project Documentation

**Version 1.0.0**  
*Multi-tenant issue tracking system for Banks, System Integrators, and Oracle clients.*

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Functional Overview](#2-functional-overview)
   - 2.1 [User Hierarchy & Roles](#21-user-hierarchy--roles)
   - 2.2 [Issue Lifecycle](#22-issue-lifecycle)
   - 2.3 [Feature Inventory](#23-feature-inventory)
3. [Technical Architecture](#3-technical-architecture)
   - 3.1 [System Architecture Diagram](#31-system-architecture-diagram)
   - 3.2 [Technology Stack](#32-technology-stack)
   - 3.3 [Database Schema](#33-database-schema)
   - 3.4 [API Layer](#34-api-layer)
   - 3.5 [Backend Architecture](#35-backend-architecture)
   - 3.6 [Frontend Architecture](#36-frontend-architecture)
   - 3.7 [Security & Compliance](#37-security--compliance)
4. [Deployment](#4-deployment)
5. [Development Guide](#5-development-guide)

---

## 1. Introduction

The Issue Tracker is a multi-tenant, role-based issue management platform designed for collaborative environments involving multiple organizational entities. It supports the full lifecycle of issue tracking — from creation through resolution and closure — with deadline monitoring, file attachments, activity logging, and real-time notifications.

---

## 2. Functional Overview

### 2.1 User Hierarchy & Roles

The system defines **three user roles** and **four organization types** that collectively govern access control and operational capabilities.

#### Organization Types

| Type | Description |
|---|---|
| `SUPER_ADMIN` | Governing entity with cross-tenant visibility |
| `CLIENT` | Client organization |
| `SI` | System Integrator organization |
| `OEM` | OEM (Oracle) client organization |

#### User Roles & Permissions

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SUPER_ADMIN                                  │
│  (Global authority — full access across all organizations)          │
│                                                                     │
│  • Create / read / update any user in any organization              │
│  • Create / manage projects                                         │
│  • Change status on any issue                                       │
│  • Full visibility into all issues, comments, attachments           │
│  • Cannot assign issues (assignment restricted to ORG_ADMIN/USER)   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
     ┌─────────────────────────┐     ┌─────────────────────────────┐
     │       ORG_ADMIN         │     │    ORGANIZATION BOUNDARY    │
     │  (Organization admin)   │     │                             │
     │                         │     │  ┌───────────────────────┐  │
     │  • Create users (USER   │     │  │        USER           │  │
     │    role only) in own    │     │  │  (Regular member)     │  │
     │    org                  │     │  │                       │  │
     │  • Update USER accounts │     │  │  • Create issues      │  │
     │    in own org           │     │  │  • Add comments       │  │
      │  • Assign issues within │     │  │  • Assign issues to   │  │
      │    own org              │     │  │    users in OTHER     │  │
      │  • Change status on     │     │  │    organizations only │  │
      │    org's issues         │     │  │    (cross-org routing)│  │
      └─────────────────────────┘     │  • Change status on   │  │
                                      │    owned/assigned     │  │
                                      │    issues             │  │
                                      │  • Receive notifications │  │
                                     └───────────────────────┘  │
                                     └─────────────────────────────┘
```

**User Status:** `ACTIVE` | `INACTIVE` — users are deactivated rather than deleted to preserve audit trails.

#### Seed Accounts

| Email | Role | Organization |
|---|---|---|
| superadmin@issuetracker.dev | SUPER_ADMIN | Super Admin |
| superviewer@issuetracker.dev | USER | Super Admin |
| bankadmin@issuetracker.dev | ORG_ADMIN | Bank |
| bankuser@issuetracker.dev | USER | Bank |
| siadmin@issuetracker.dev | ORG_ADMIN | Data Edge (SI) |
| siuser@issuetracker.dev | USER | Data Edge (SI) |
| oracleadmin@issuetracker.dev | ORG_ADMIN | Oracle |
| oracleuser@issuetracker.dev | USER | Oracle |

*All seed passwords:* `password123`

#### Departments

Departments subdivide organizations (e.g., IT Department). Each organization starts with an IT department (seed data creates `name: 'IT'`). ORG_ADMINs are automatically managers of their organization's IT department. Department managers can be added or removed by administrators; multiple managers per department are supported. Users belong to departments via the `departmentId` field on the User model. ORG_ADMIN has no department (shows "Admin" in the UI) — they are organization-wide. Department assignment is displayed as "Org Name (Dept Name)", e.g. "Brac Bank (IT)".

---

### 2.2 Issue Lifecycle

Issues traverse a defined state machine with enforced transition rules:

```
                   ┌──────────────────────────────────────────────┐
                   │                    NEW                       │
                   └────┬──────────────┬──────────────────────────┘
                        │              │
                        ▼              ▼
               ┌──────────────┐  ┌──────────┐
               │ ACKNOWLEDGED │  │ ASSIGNED │
               └──────┬───────┘  └────┬─────┘
                      │               │
                      └───────┬───────┘
                              ▼
                      ┌──────────────┐
                      │  IN_PROGRESS │
                      └──────┬───────┘
                             │
                             ▼
                      ┌──────────────┐
                      │   RESOLVED   │◄──── Resolution note required
                      └──────┬───────┘
                            / \
                           /   \
                          ▼     ▼
                   ┌────────┐  ┌──────────┐
                   │VERIFIED│  │ REOPENED │◄──── Comment required
                   └───┬────┘  └────┬─────┘
                       │            │
                       ▼            │
                 ┌────────┐         │
                 │ CLOSED │         └──────────► IN_PROGRESS
                 └───┬────┘            (re-entry)
                     │
                     └──────► REOPENED
                  (raiser's org
                   admin only)
```

**Transition Rules:**
- **CLOSED → REOPENED** — Only an `ORG_ADMIN` in the issue creator's organization or a `SUPER_ADMIN` can reopen a closed issue.
- **Verify / Close** — Only the issue creator (raised-by user) or an `ORG_ADMIN` in the creator's organization can transition to `VERIFIED` or `CLOSED`. The resolver (assigned user/org) cannot.
- **Reopened assignment** — When assigned, a `REOPENED` issue auto-transitions to `ASSIGNED`.
- **Resolution note** required for `RESOLVED`. **Comment** required for `REOPENED`.

**Issue Types:** `BUG` | `NEW_REQUIREMENT` | `CHANGE_REQUEST` | `QUERY`  
**Priority Levels:** `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`

---

### 2.3 Feature Inventory

#### Issue Management
- Create issues with title, description, type, priority, deadline, module, and project classification
- List and filter issues by status, priority, type, module, overdue status, assigned organization, and project
- **Concern tab** — personalized issue view showing issues relevant to the user (raised by them, assigned to them, or related to their org)
  - Sub-filters: All, Raised, Assign (org admin sees org-wide; user sees own only)
- Paginated issue listing with configurable page size
- Assign/reassign issues to users or organizations with cross-org routing rules:
  - SUPER_ADMIN cannot assign issues (full access to all other operations)
  - USER can assign to users in other organizations only (cross-org)
  - ORG_ADMIN can assign within their own org only
  - Assigned USER can reroute to their own org admin only
  - Issue in org queue must stay within that org during active lifecycle
  - Reopened issues can be redistributed to outside orgs by raiser's org admin
  - Cross-org type restriction: cannot assign to an org of the same type as the actor's org
- Full state machine enforcement with role-based transition authorization
  - CLOSED → REOPENED restricted to raiser's org admin or SUPER_ADMIN
  - VERIFY/CLOSE restricted to issue creator or creator's org admin
- Resolution notes (required for RESOLVED) and re-open comments (required for REOPENED)
- **Delete issue** — restricted to the issue creator, ORG_ADMIN of the creator's org, or SUPER_ADMIN

#### Project Management
- Projects group issues by organizational membership and scope visibility
- **SUPER_ADMIN** creates projects with at least one CLIENT, one SI, and one OEM organization
- All active users from member organizations are auto-added as project members
- Issue visibility is scoped to project membership — non-members cannot see project-scoped issues
- ORG_ADMIN can manage project members from their own organization
- Dashboard, notifications, and issue lists can be filtered by project

#### Comments & Collaboration
- Add comments to any issue with optional file attachments
- Full activity log tracking all changes on each issue

#### File Attachments
- Upload to issues or comments (max 5 files per request, 15 MB each)
- MIME type allowlist validation (images, PDF, Word, Excel, CSV)
- Magic byte verification preventing MIME spoofing
- Security scan hook (pluggable)
- Secure file download with proper Content-Disposition headers

#### Notifications
- In-app notifications for assignments and status changes
- Unread count badge and notification center with pagination
- Mark individual or all notifications as read
- Email notifications via SMTP (Nodemailer) for assignments and overdue issues

#### Deadline Monitoring
- Automated cron job (every 30 minutes) tracking issue deadlines
- Warning notification when 80% of deadline time has elapsed
- Overdue notification when deadline passes
- Overdue escalation emails to assignees, organization admins, and super admins

#### User Management
- Create, list, and update users with role-based restriction
- Soft-delete users (clear email/password, set INACTIVE) preserving issue history (FK integrity)
- Delete organizations (soft-deletes all users, keeps org record for historical issues)
- **Silent Delete section** (SUPER_ADMIN only) showing all soft-deleted users and organizations
- Permanent delete with cascade (removes user/org and all related issues, comments, attachments, notifications, activity logs)
- Organization-scoped user listing

#### Department Management
- Create/delete departments within organizations
- Manage department managers (add/remove, multiple managers per department)
- Manager badge shown in department list
- Issue routing to departments (third assignment target alongside user and org)
- Departments scoped to projects — a department must be added to a project before its issues can be routed there
- Auto-add all ACTIVE users from a department as project users when the department is added to a project
- Removing a department from a project unassigns department-assigned issues (reassigns to org queue)
- Issues cannot be routed to a department in the same org as the issue raiser (cross-org routing only)

#### Dashboard & Reporting
- Summary cards: total open, overdue, critical, and resolved this month counts
- Breakdown by status, priority, and type with drill-down links
- 30-day trend (daily created vs resolved issue counts)
- Average resolution time (days)
- My assigned issues (top 5 by deadline)
- Recent activity (last 10 actions)
- Org comparison (SUPER_ADMIN only): open and overdue counts per organization
- Project-scoped filtering

#### Password Reset
- Forgot password flow via email (rate-limited: 3 req/min)
- Reset password with time-limited token (1 hour expiry)
- Email enumeration prevention (generic response for unregistered emails)

#### Health Monitoring
- Public health check endpoint with database connectivity status

---

## 3. Technical Architecture

### 3.1 System Architecture Diagram

```
┌─────────────┐       ┌──────────────────────────────────────────────────┐
│             │       │                 BACKEND (NestJS)                 │
│   Browser   │◄─────►│                                                  │
│  (React     │       │  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│   SPA)      │  HTTP │  │   Auth   │  │  Issues  │  │ Notifications │ │
│             │       │  │  Module  │  │  Module  │  │    Module     │ │
│  Vite       │       │  └────┬─────┘  └────┬─────┘  └───────┬───────┘ │
│  Tailwind   │       │       │              │                │         │
│  React      │       │  ┌────▼──────────────▼────────────────▼──────┐ │
│  Query      │       │  │           Application Layer                │ │
└─────────────┘       │  │  Guards (JWT · Roles) · Validators · Pipes │ │
                      │  └────────────────────┬───────────────────────┘ │
                      │                       │                         │
                      │  ┌────────────────────▼───────────────────────┐ │
                      │  │           Prisma ORM Layer                  │ │
                      │  └────────────────────┬───────────────────────┘ │
                      └───────────────────────┼─────────────────────────┘
                                              │
                                              ▼
                      ┌──────────────────────────────────────────────────┐
                      │              PostgreSQL 15                       │
                      │              (Single Database)                   │
                      │                                                  │
                      │  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
                      │  │  Users   │  │  Issues  │  │Notifications  │ │
                      │  │ Orgs     │  │Comments  │  │ActivityLogs   │ │
                      │  │          │  │Attachmts │  │               │ │
                      │  └──────────┘  └──────────┘  └───────────────┘ │
                      └──────────────────────────────────────────────────┘

External Services:
  ┌──────────────┐
  │  SMTP Server │◄──── Email notifications via Nodemailer
  └──────────────┘

  ┌──────────────┐
  │   File I/O   │◄──── Local filesystem storage (pluggable: S3, etc.)
  └──────────────┘
```

### 3.2 Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **Backend Framework** | NestJS (TypeScript) | 10.x |
| **ORM** | Prisma | 5.x |
| **Database** | PostgreSQL | 15 |
| **Authentication** | Passport.js + JWT (httpOnly cookies) | — |
| **Validation** | class-validator + class-transformer | — |
| **Email** | Nodemailer (SMTP) | — |
| **Scheduling** | @nestjs/schedule (cron) | — |
| **Rate Limiting** | @nestjs/throttler | — |
| **File Validation** | file-type (magic bytes) | — |
| **Testing** | Jest + Supertest | — |
| **Frontend Framework** | React (TypeScript) | 18 |
| **Build Tool** | Vite | 5 |
| **Styling** | Tailwind CSS | 3 |
| **Routing** | react-router-dom | 7 |
| **Server State** | @tanstack/react-query | 5 |
| **Date Handling** | date-fns | 4 |
| **Containerization** | Docker + Docker Compose | — |
| **Cloud Deployment** | Render.com | — |

---

### 3.3 Database Schema

Fourteen database tables (models) defined in Prisma schema:

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│ Organization │       │      User        │       │      Issue       │
├──────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)      │◄──────│ organizationId   │       │ id (PK)          │
│ name         │  1:N  │ id (PK)          │       │ title            │
│ type (ENUM)  │       │ name             │       │ description      │
│ createdAt    │       │ email (unique)   │       │ type (ENUM)      │
└──────────────┘       │ passwordHash     │       │ priority (ENUM)  │
                       │ phone            │       │ status (ENUM)    │
                       │ role (ENUM)      │       │ module           │
                       │ status (ENUM)    │       │ deadline         │
                       │ createdAt        │       │ projectId (FK)   │
                       │ updatedAt        │       ├──────────────────┤
                       └────────┬─────────┘       │ raisedById (FK)  │
                                │                 │ raisedByOrgId(FK)│
                                │ 1:N             │ assignedToUserId │
                                │                 │ assignedToOrgId  │
                                │                 │ assignedById     │
                                │                 │ resolutionNote   │
                                │                 │ resolvedById     │
                                │                 │ resolvedAt       │
                                │                 │ closedAt         │
                                │                 │ lastNotifiedStage│
                                │                 └────────┬─────────┘
                                │                          │
        ┌───────────────────────┼──────────────────────────┘
        │                       │
        ▼                       ▼
┌───────────────┐      ┌──────────────────┐
│  Comment      │      │  IssueAssignee   │
├───────────────┤      ├──────────────────┤
│ id (PK)       │      │ id (PK)          │
│ issueId (FK)  │      │ issueId (FK)     │
│ userId (FK)   │      │ userId (FK)      │
│ text          │      │ assignedById     │
│ createdAt     │      │ assignedAt       │
└───────┬───────┘      └──────────────────┘
        │
        │
        ▼
┌───────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   Attachment      │   │  ActivityLog     │   │  Notification    │
├───────────────────┤   ├──────────────────┤   ├──────────────────┤
│ id (PK)           │   │ id (PK)          │   │ id (PK)          │
│ issueId (FK)      │   │ issueId (FK)     │   │ userId (FK)      │
│ commentId (FK)    │   │ userId (FK)      │   │ issueId (FK)     │
│ uploadedById (FK) │   │ action           │   │ message          │
│ fileName          │   │ oldValue         │   │ type (ENUM)      │
│ fileType          │   │ newValue         │   │ isRead           │
│ fileSize          │   │ createdAt        │   │ createdAt        │
│ storagePath       │   └──────────────────┘   └──────────────────┘
│ createdAt         │
└───────────────────┘

┌──────────────────┐   ┌─────────────────────┐   ┌──────────────────────┐
│     Project      │   │ ProjectOrganization │   │     ProjectUser      │
├──────────────────┤   ├─────────────────────┤   ├──────────────────────┤
│ id (PK)          │   │ id (PK)             │   │ id (PK)              │
│ name (unique)    │   │ projectId (FK)      │   │ projectId (FK)       │
│ description      │   │ organizationId (FK) │   │ userId (FK)          │
│ createdAt        │   │ createdAt           │   │ addedById (FK)       │
│ updatedAt        │   └─────────────────────┘   │ createdAt            │
└──────────────────┘                             └──────────────────────┘

┌──────────────────────────┐
│   PasswordResetToken     │
├──────────────────────────┤
│ id (PK)                  │
│ userId (FK)              │
│ token (unique)           │
│ expiresAt                │
│ createdAt                │
└──────────────────────────┘

┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   Department     │   │DepartmentManager │   │ProjectDepartment │
├──────────────────┤   ├──────────────────┤   ├──────────────────┤
│ id (PK)          │   │ id (PK)          │   │ id (PK)          │
│ name             │   │ departmentId(FK) │   │ projectId (FK)   │
│ organizationId   │   │ userId (FK)      │   │ departmentId(FK) │
│ createdAt        │   │ createdAt        │   │ createdAt        │
└──────────────────┘   └──────────────────┘   └──────────────────┘
```

**Enums:** `OrganizationType` · `UserRole` · `UserStatus` · `IssueType` · `IssuePriority` · `IssueStatus` · `NotificationType` · `NotifiedStage`

**Relationships:**
- Organization 1:N Department
- Department 1:N DepartmentManager
- User 1:N DepartmentManager
- Department 1:N User (departmentId on User)
- Department 1:N Issue (assignedToDepartmentId on Issue)
- Project M:N Department via ProjectDepartment

---

### 3.4 API Layer

All endpoints are prefixed with `/api`. Authentication is enforced globally (JWT guard) with opt-out via `@Public()` decorator.

#### Health
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/health` | Public | System health with DB status |

#### Auth
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/api/auth/login` | Public | Authenticate (rate-limited: 5/60s) |
| POST | `/api/auth/logout` | Authenticated | Clear session |
| GET | `/api/auth/me` | Authenticated | Current user profile |
| POST | `/api/auth/forgot-password` | Public | Request password reset (rate-limited: 3/60s) |
| POST | `/api/auth/reset-password` | Public | Reset password with token (rate-limited: 5/60s) |

#### Users
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/api/users` | Admin | Create user |
| GET | `/api/users` | Authenticated | List users (scoped) |
| GET | `/api/users/assignable` | Authenticated | Active users for assignment (optional `?issueId=` for assignee context) |
| GET | `/api/users/deleted` | SUPER_ADMIN | List soft-deleted users |
| PATCH | `/api/users/:id` | Admin | Update user |
| DELETE | `/api/users/:id` | Admin | Soft-delete user |
| DELETE | `/api/users/:id/permanent` | SUPER_ADMIN | Permanently delete user and all related issues |

#### Organizations
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/organizations` | Authenticated | List organizations (excludes soft-deleted) |
| GET | `/api/organizations/deleted` | SUPER_ADMIN | List soft-deleted organizations |
| DELETE | `/api/organizations/:id` | SUPER_ADMIN | Soft-delete organization |
| DELETE | `/api/organizations/:id/permanent` | SUPER_ADMIN | Permanently delete organization and all related data |

#### Departments
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/departments` | Admin | List departments (scoped by org) |
| GET | `/api/departments/:id` | Admin | Get department detail |
| POST | `/api/departments` | Admin | Create department |
| DELETE | `/api/departments/:id` | Admin | Delete department |
| GET | `/api/departments/:id/managers` | Admin | List department managers |
| POST | `/api/departments/:id/managers` | Admin | Add department manager |
| DELETE | `/api/departments/:id/managers/:userId` | Admin | Remove department manager |

#### Issues
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/api/issues` | Authenticated | Create issue |
| GET | `/api/issues` | Authenticated | List/filter issues (`concern`, `concernFilter` params) |
| GET | `/api/issues/:id` | Authenticated | Issue details |
| PATCH | `/api/issues/:id/assign` | Authorized | Assign/reassign (role-based rules) |
| PATCH | `/api/issues/:id/status` | Authorized | Update status (state machine) |
| DELETE | `/api/issues/:id` | Creator / ORG_ADMIN of raised org / SUPER_ADMIN | Delete issue permanently |
| POST | `/api/issues/:id/attachments` | Authenticated | Upload files (max 5) |
| POST | `/api/issues/:id/comments` | Authenticated | Add comment |
| GET | `/api/issues/:id/activity` | Authenticated | Activity log |

#### Attachments
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/attachments/:id/download` | Authenticated | Download file |

#### Notifications
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/notifications` | Authenticated | List notifications |
| GET | `/api/notifications/unread-count` | Authenticated | Unread count |
| PATCH | `/api/notifications/:id/read` | Authenticated | Mark read |
| PATCH | `/api/notifications/read-all` | Authenticated | Mark all read |

#### Dashboard
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/dashboard/summary` | Authenticated | Aggregated issue counts (status, priority) |
| GET | `/api/dashboard/metrics` | Authenticated | Extended metrics (trends, resolution time, org comparison) |

#### Projects
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/api/projects` | SUPER_ADMIN | Create project (requires CLIENT + SI + OEM orgs) |
| GET | `/api/projects` | Authenticated | List projects (scoped by role) |
| GET | `/api/projects/:id` | Project member | Get project detail |
| PATCH | `/api/projects/:id` | SUPER_ADMIN | Update project |
| DELETE | `/api/projects/:id` | SUPER_ADMIN | Delete project |
| GET | `/api/projects/:id/organizations` | Project member | List project organizations |
| POST | `/api/projects/:id/organizations` | SUPER_ADMIN | Add organization to project |
| DELETE | `/api/projects/:id/organizations/:orgId` | SUPER_ADMIN | Remove organization from project |
| GET | `/api/projects/:id/users` | Project member | List project users |
| POST | `/api/projects/:id/users` | SUPER_ADMIN / ORG_ADMIN | Add user to project |
| DELETE | `/api/projects/:id/users/:userId` | SUPER_ADMIN / ORG_ADMIN | Remove user from project |
| GET | `/api/projects/:id/departments` | Project member | List project departments |
| POST | `/api/projects/:id/departments` | Admin | Add department to project |
| DELETE | `/api/projects/:id/departments/:deptId` | Admin | Remove department from project |

---

### 3.5 Backend Architecture

The backend follows NestJS module architecture with clean separation of concerns:

```
backend/src/
├── main.ts                      # Bootstrap: CORS, cookieParser, global prefix, ValidationPipe
├── app.module.ts                # Root module (global guards, throttler, all feature modules)
│
└── modules/
    ├── prisma/                  # Database access layer (global PrismaClient singleton)
    ├── health/                  # System health check
    ├── auth/                    # Authentication & authorization
    │   ├── guards/              # JwtAuthGuard, RolesGuard
    │   ├── strategies/          # JWT strategy (Passport)
    │   ├── decorators/          # @Public(), @Roles(), @CurrentUser()
    │   ├── auth.service.ts      # Login, authorization logic (canAssign, canActOnIssue)
    │   └── auth.controller.ts   # Login, logout, me, forgot-password, reset-password
    ├── users/                   # User CRUD with role-based restrictions
    ├── organizations/           # Organization listing and management
    ├── projects/                # Project management (org/user membership, visibility scoping)
    │   ├── projects.service.ts  # CRUD + membership + visibility filter logic
    │   ├── projects.controller.ts
    │   └── dto/                 # Request validation DTOs
    ├── departments/             # Department management (managers, project-scoped routing)
    ├── issues/                  # Core issue management
    │   ├── state-machine.ts     # Transition rules and validations
    │   └── dto/                 # Request validation DTOs
    ├── attachments/             # File upload/download with security validation
    ├── storage/                 # Storage abstraction layer (local disk implementation)
    └── notifications/           # In-app and email notifications
        ├── email.service.ts     # SMTP email sender (graceful degradation)
        └── deadline-monitor.service.ts  # Cron-based deadline tracking
```

**Key Design Decisions:**

- **Global JWT guard** — All routes authenticated by default; security-by-default approach
- **State machine pattern** — Issue status transitions are validated against a declarative transition map (`state-machine.ts`)
- **Storage abstraction** — `StorageService` abstract class enables swapping between local filesystem and cloud storage (S3, GCS, Azure Blob)
- **Attachment security** — Two-layer MIME validation: Content-Type header + magic byte detection via `file-type` library
- **Deadline monitoring** — Cron-based in-process scheduler (every 30 minutes); uses `lastNotifiedStage` field to prevent duplicate notifications in multi-instance deployments
- **Email graceful degradation** — SMTP configuration is optional; system operates normally if email is not configured

---

### 3.6 Frontend Architecture

The frontend is a single-page application built with React 18 and managed with Vite.

```
frontend/src/
├── main.tsx                     # React entry point
├── App.tsx                      # Router + QueryClientProvider + AuthProvider
├── index.css                    # Tailwind CSS base styles
│
├── api/                         # HTTP client layer
│   ├── client.ts                # Fetch wrapper (apiGet, apiPost, apiPatch) with auth handling
│   ├── auth.ts                  # Login, logout, getMe, forgot-password, reset-password
│   ├── users.ts                 # User CRUD + organization listing
│   ├── issues.ts                # Issues CRUD + comments + attachments
│   ├── projects.ts              # Projects CRUD + org/user membership
│   ├── departments.ts           # Department CRUD + managers
│   ├── dashboard.ts             # Dashboard summary + metrics
│   └── notifications.ts         # Notifications + unread count
│
├── context/
│   └── AuthContext.tsx           # Authentication state (React Context)
│
├── components/                  # Shared/reusable UI components
│   ├── AppShell.tsx             # Layout: sidebar navigation + topbar + content outlet
│   ├── ProtectedRoute.tsx       # Route guard (redirects to /login)
│   ├── StatusBadge.tsx          # Color-coded status pill
│   ├── PriorityBadge.tsx        # Color-coded priority pill
│   ├── NotificationBell.tsx     # Topbar notification dropdown with unread count
│   └── Pagination.tsx           # Reusable pagination control
│
└── pages/                       # Route-level page components
    ├── Login.tsx                # Authentication form with validation
    ├── ForgotPassword.tsx       # Password reset request form
    ├── ResetPassword.tsx        # Password reset form with token
    ├── Dashboard.tsx            # Summary cards + extended metrics + trends
    ├── Concern.tsx              # Personalized issue list (raised/assigned/org-related)
    ├── Issues.tsx               # Filterable, paginated issue list
    ├── IssueDetail.tsx          # Full detail: metadata, status transitions, comments, activity
    ├── CreateIssue.tsx          # Issue creation form with file upload
    ├── Projects.tsx             # Project listing and management
    ├── ProjectDetail.tsx        # Project detail with org/user membership
    ├── Departments.tsx          # Department listing and management
    ├── Notifications.tsx        # Notification center with filter/pagination
    └── Users.tsx                # Admin user management with modals
```

**State Management Strategy:**

| Concern | Mechanism |
|---|---|
| Authentication | React Context (`AuthContext`) |
| Server data | TanStack React Query (caching, refetching, optimistic updates) |
| Form state | Local component state |
| Routing | react-router-dom v7 |

**UI/UX Features:**

- Responsive sidebar layout with role-based navigation (Dashboard, Concern, Issues, Notifications, Users for admins)
- Color-coded status and priority badges for quick visual scanning
- Filterable and paginated issue list with search
- Drag-and-drop file upload with progress indication
- Real-time notification bell with unread badge
- Dashboard with linked summary cards for drill-down navigation

---

### 3.7 Security & Compliance

| Measure | Implementation |
|---|---|
| **Authentication** | JWT in httpOnly, secure, sameSite cookies |
| **Authorization** | Role-based access control (SUPER_ADMIN / ORG_ADMIN / USER) |
| **Password Security** | bcrypt hashing (10 salt rounds) |
| **Rate Limiting** | 100 req/min global; 5 req/min on login |
| **File Validation** | MIME type allowlist + magic byte verification |
| **Input Validation** | class-validator DTOs with whitelist mode |
| **SQL Injection** | Prisma ORM (parameterized queries) |
| **XSS** | React's built-in sanitization |
| **CSRF** | Cookie-based auth (sameSite: lax) |
| **User Deactivation** | Soft delete (clear email/password, status: INACTIVE) preserving audit trail and FK integrity |

---

## 4. Deployment

### Docker Compose (Local Development)

```yaml
Services:
  - postgres:15     # Database on port 5432
  - backend         # NestJS API on port 3000
  - frontend        # React SPA on port 5173
```

### Render.com (Production)

Defined in `render.yaml` with a PostgreSQL 15 instance and Docker-based services.

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing key |
| `JWT_EXPIRATION` | Token expiry (default: 7d) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email configuration (optional) |
| `UPLOAD_DIR` | File storage path |
| `MAX_FILE_SIZE` | File size limit (default: 15MB) |
| `FRONTEND_URL` | CORS origin |

---

## 5. Development Guide

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development without Docker)

### Quick Start
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose -f docker/docker-compose.yml up --build
```

### Testing
```bash
# Integration tests (requires test database)
cd backend
npm test
```

### Project Conventions
- **Backend:** NestJS module structure, service-based business logic, DTO-based validation
- **Frontend:** Page-based routing, API client abstraction with TanStack Query, Tailwind CSS utility-first styling
- **Database:** Prisma migrations with seed data for development
- **Git:** Conventional commits (feature branches → main)

---

*Document generated July 2026*
