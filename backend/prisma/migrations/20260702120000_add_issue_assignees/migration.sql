-- Create IssueAssignee join table for many-to-many assignments
CREATE TABLE "issue_assignees" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_by_id" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_assignees_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint to prevent duplicate assignments
CREATE UNIQUE INDEX "issue_assignees_issue_id_user_id_key" ON "issue_assignees"("issue_id", "user_id");

-- Add indexes
CREATE INDEX "issue_assignees_issue_id_idx" ON "issue_assignees"("issue_id");
CREATE INDEX "issue_assignees_user_id_idx" ON "issue_assignees"("user_id");

-- Add foreign keys
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignees_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignees_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL;