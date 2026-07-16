# QA Review: Bug Tracker Backend

## Summary
Comprehensive review of NestJS backend for hidden edge cases, boundary value limits, and null/empty state scenarios that current logic fails to handle.

---

## CRITICAL Issues

### 1. Non-Project Issue Authorization Bypass
**Location:** `issues.service.ts:184-216`, `issues.service.ts:475-504`, `issues.service.ts:506-513`
**Issue:** `findOne`, `addComment`, and `addAttachments` only call `assertProjectAccess` when `issue.projectId` is truthy. Issues without a project have **zero access control** — any authenticated user who knows the UUID can read, comment on, or attach files to any unassigned issue.
**Impact:** Data leakage, unauthorized modifications to private issues.
**Proposed Fix:** Add a visibility rule for `projectId === null` issues: only the raiser, assigned user, or assigned org members may access.

### 2. Null Pointer Dereference in Assignment
**Location:** `issues.service.ts:247`
**Issue:** When `dto.targetUserId` is provided but the target user is `INACTIVE`, `newTargetUser` is `null`. Line 247 accesses `newTargetUser.organizationId` without optional chaining, causing a `TypeError` crash.
**Impact:** 500 Internal Server Error on assignment to inactive users.
**Proposed Fix:** Use `newTargetUser?.organizationId` or validate target user active status earlier.

### 3. State Machine Bypass in Assignment
**Location:** `issues.service.ts:312`
**Issue:** Assignment forces status to `ASSIGNED` for `NEW`, `ACKNOWLEDGED`, and `REOPENED` issues. The state machine defines `REOPENED -> IN_PROGRESS` (not `ASSIGNED`), so assignment bypasses the defined workflow.
**Impact:** Invalid state transitions corrupt issue lifecycle tracking.
**Proposed Fix:** Align assignment status transitions with the state machine, or route through `canTransition` before mutating status.

### 4. Orphaned Notifications on Issue Delete
**Location:** `issues.service.ts:525-536`
**Issue:** `prisma.issue.delete` cascades to comments and attachments via schema `onDelete: Cascade`, but `Notification` model has no cascade defined. Deleting an issue leaves orphaned notification records.
**Impact:** Database integrity, potential leaks in notification lists.
**Proposed Fix:** Manually delete notifications for the issue before deleting the issue, or add cascade in schema.

---

## HIGH Issues

### 5. Pagination NaN Injection
**Location:** `issues.service.ts:160-162`, `notifications.service.ts:76-78`
**Issue:** `parseInt(query.page || '1', 10)` returns `NaN` for non-numeric strings (e.g., `page=abc`). `Math.max(1, NaN)` yields `NaN`, and `(NaN - 1) * limit` propagates `NaN` into Prisma `skip`/`take`.
**Impact:** Unhandled exception or empty result sets instead of graceful fallback.
**Proposed Fix:** Add `isNaN` guard: `const page = Math.max(1, parseInt(query.page || '1', 10) || 1)`.

### 6. Dashboard "Resolved This Month" Counts Non-Resolved Updates
**Location:** `notifications.service.ts:417-423`
**Issue:** `resolvedThisMonth` counts issues with `status in [RESOLVED, CLOSED, VERIFIED]` and `updatedAt >= startOfMonth`. An issue resolved in January but commented on in July is counted as "resolved this month."
**Impact:** Inaccurate metrics misleading stakeholders.
**Proposed Fix:** Use `resolvedAt >= startOfMonth` instead of `updatedAt`.

### 7. Organization Soft-Delete Leaves Orphaned Assignments
**Location:** `organizations.service.ts:125-126`
**Issue:** Soft-deleting an organization clears `assignedToOrgId` but does **not** clear `assignedToUserId` for users from that org. Issues can reference soft-deleted users.
**Impact:** Broken assignment references, incorrect activity tracking.
**Proposed Fix:** Also clear `assignedToUserId` for users whose org is being soft-deleted.

### 8. Project Organization Removal Leaves Stale Assignment Refs
**Location:** `projects.service.ts:280-296`
**Issue:** `removeOrganization` clears `assignedToUserId` and `assignedToOrgId`, but does **not** clear `assignedById` or `resolvedById` for users from the removed org.
**Impact:** Activity audit trail shows non-existent users as assigners/resolvers.
**Proposed Fix:** Clear `assignedById` and `resolvedById` alongside `assignedToUserId`.

### 9. CSV MIME Detection False Positives
**Location:** `attachments.service.ts:72-75`
**Issue:** CSV magic-byte check uses `/^[a-zA-Z0-9",\-]/`, which matches nearly any text file (Python scripts, JSON, logs). A 1KB `.py` file starting with `import` passes as `text/csv`.
**Impact:** Security scan bypass, incorrect file type metadata.
**Proposed Fix:** Require CSV-specific signatures (RFC 4180 header detection, comma+newline patterns, or stricter magic-byte library).

### 10. Attachment Metadata Exposes Internal Paths
**Location:** `attachments.service.ts:251-263`
**Issue:** `getAttachmentMeta` returns the full `attachment` record including `storagePath`. Any authenticated user can enumerate storage paths.
**Impact:** Information disclosure, potential path traversal reconnaissance.
**Proposed Fix:** Strip `storagePath` from the response or add access-control checks before returning metadata.

---

## MEDIUM Issues

### 11. Missing Title Length Validation
**Location:** `create-issue.dto.ts`
**Issue:** `@IsNotEmpty()` ensures non-empty title but no max-length guard. A 10,000-character title wastes DB storage and may break frontend rendering.
**Impact:** DoS via large payloads, UI breakage.
**Proposed Fix:** Add `@IsLength(1, 255)` to title.

### 12. No Comment Text Length Guard
**Location:** `add-comment.dto.ts`
**Issue:** `@IsNotEmpty()` allows arbitrarily long comment text.
**Impact:** Memory/DB bloat, frontend rendering issues.
**Proposed Fix:** Add `@IsLength(1, 5000)` (or appropriate limit).

### 13. Race Condition: Project Check Then Create
**Location:** `issues.service.ts:48-54` then `60-77`
**Issue:** `projectExists` check and `issue.create` are separate DB calls. Between them, the project could be deleted, causing an FK constraint violation.
**Impact:** 500 error on race condition.
**Proposed Fix:** Wrap in a transaction or rely on DB FK constraint with a clearer error message.

### 14. `resolvedAt` Set Without `resolvedBy` on Concurrent Delete
**Location:** `issues.service.ts:427-435`
**Issue:** If the resolving user is deleted between `findOne` and `updateStatus`, `resolvedAt` is set but `resolvedBy` is not connected. The issue ends up in an inconsistent state (`RESOLVED` with no resolver).
**Impact:** Audit trail gap.
**Proposed Fix:** Either reject the status change if the actor no longer exists, or handle the null `resolvedBy` gracefully.

### 15. `CLOSED` Status Retains `resolvedAt`/`resolutionNote`
**Location:** `issues.service.ts:419-424`
**Issue:** Transitioning to `CLOSED` does not clear `resolvedAt` or `resolutionNote` set during `RESOLVED`. An issue can be both `RESOLVED` and `CLOSED` simultaneously.
**Impact:** State ambiguity.
**Proposed Fix:** Clear resolution fields when moving to `CLOSED` from non-`RESOLVED`, or enforce strict state transitions.

### 16. Empty `module` Filter Matches Everything
**Location:** `issues.service.ts:120`
**Issue:** `module: { contains: query.module, mode: 'insensitive' }` — if `query.module` is empty string, `contains: ''` matches all records.
**Impact:** Unintended full-table scan when filter is blank.
**Proposed Fix:** Skip module filter when `query.module` is empty/whitespace.

### 17. `concern` and `overdue` Query Params Case-Sensitive
**Location:** `issues.service.ts:122`, `126`
**Issue:** `query.overdue === 'true'` and `query.concern === 'true'` are strict string comparisons. `?overdue=True` or `?concern=TRUE` is silently ignored.
**Impact:** Poor API ergonomics, hard-to-debug missing filters.
**Proposed Fix:** Normalize: `query.overdue?.toLowerCase() === 'true'`.

### 18. `concernFilter` Accepts Arbitrary Values
**Location:** `issues.service.ts:129`
**Issue:** Any `concernFilter` value other than `'raised'` or `'assigned'` falls into the `else` branch (both). Empty string behaves like `'both'`.
**Impact:** Silent misbehavior.
**Proposed Fix:** Validate `concernFilter` against allowed enum values.

### 19. `findOne` Returns DB Error for Invalid UUID Format
**Location:** `issues.controller.ts:47`, `issues.service.ts:185`
**Issue:** No validation that `id` matches UUID format. Invalid IDs reach Prisma and produce raw DB errors instead of clean `404 Not Found`.
**Impact:** Poor error response, potential info leakage.
**Proposed Fix:** Validate UUID format in controller or DTO before DB call.

### 20. Soft-Deleted Users Still Receive Overdue Notifications
**Location:** `notifications.service.ts:283-289`, `306-313`
**Issue:** `sendOverdueNotifications` adds `assignedToUserId` and org users without filtering by `status: 'ACTIVE'`. Inactive/soft-deleted users receive notifications.
**Impact:** Notification noise, potential confusion.
**Proposed Fix:** Filter recipient queries by `status: 'ACTIVE'`.

### 21. Deadline Monitor Warning Reset Logic Is Fragile
**Location:** `notifications.service.ts:222-231`
**Issue:** Warning is only sent when `lastNotifiedStage === NONE`. If an issue is reassigned (which resets stage to `NONE`) after the warning was already sent, a second warning is sent. While intentional, there is no deduplication within a single monitoring cycle if the same issue is processed twice.
**Impact:** Duplicate notifications on rapid reassign + cron overlap.
**Proposed Fix:** Add idempotency key or check recent notification history.

### 22. No `projectId` Validation on Create
**Location:** `create-issue.dto.ts`
**Issue:** `projectId` is `@IsNotEmpty()` but not validated as UUID. Empty strings or malformed IDs reach the DB.
**Impact:** Unclear error messages.
**Proposed Fix:** Add `@IsUUID()` validation.

### 23. Missing Authorization on Attachment Downloads
**Location:** `attachments.controller.ts:21-34`, `attachments.service.ts:251-279`
**Issue:** Any authenticated user can download any attachment regardless of issue visibility or project membership.
**Impact:** Data exfiltration.
**Proposed Fix:** Check issue visibility (via `assertProjectAccess`) before returning the download stream.

---

## LOW Issues

### 24. Duplicate `MAX_UPLOAD_SIZE_MB` Parsing
**Location:** `issues.controller.ts:28-29`, `attachments.controller.ts:12-13`, `attachments.service.ts:82`
**Issue:** Env var is parsed in three places. If `MAX_UPLOAD_SIZE_MB` changes between controller read and service read, behavior is inconsistent (unlikely but sloppy).
**Proposed Fix:** Centralize in a shared config service or constant module.

### 25. Fire-and-Forget Emails Hide Failures
**Location:** `issues.service.ts:353-355`, `369-374`, `notifications.service.ts:336-342`
**Issue:** Email failures are logged but never retried or surfaced to the user. Critical assignment/overdue emails may silently fail.
**Impact:** Missed notifications.
**Proposed Fix:** Add a dead-letter queue or retry mechanism for critical transactional emails.

### 26. Soft-Delete Leaves Orphaned Activity Logs
**Location:** `users.service.ts:325-339`
**Issue:** Soft-deleting a user deletes their activity logs (`activityLog.deleteMany`). But issues, comments, and attachments created by the user remain, breaking referential display in activity feeds.
**Impact:** Missing audit trail entries.
**Proposed Fix:** Either preserve activity logs or anonymize the user reference rather than delete.

### 27. `issueAssignee` Table Exists but Is Unused in Core Flow
**Location:** `schema.prisma:205-218`, `users.service.ts:271-286`
**Issue:** The schema defines `IssueAssignee` join table, but the core `Issue` model uses `assignedToUserId`/`assignedToOrgId` directly. `permanentRemove` cleans up `issueAssignee`, suggesting it was used or planned, but `assign` in `issues.service.ts` never writes to it.
**Impact:** Dead schema complexity, potential confusion.
**Proposed Fix:** Remove the model if unused, or integrate it into the assignment flow.

---

## Recommended Fix Priority

| Priority | Count | Focus |
|----------|-------|-------|
| CRITICAL | 4 | Auth bypasses, crashes, data loss |
| HIGH | 10 | Logic errors, metrics accuracy, stale refs |
| MEDIUM | 13 | Input validation, error handling, ergonomics |
| LOW | 4 | Code hygiene, observability |
