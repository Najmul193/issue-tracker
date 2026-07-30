-- AlterEnum: Remove IN_QA status (never used, dead code)

-- Step 1: Drop the default on the status column first
ALTER TABLE "issues" ALTER COLUMN "status" DROP DEFAULT;

-- Step 2: Rename the old enum
ALTER TYPE "IssueStatus" RENAME TO "IssueStatus_old";

-- Step 3: Create the new enum without IN_QA
CREATE TYPE "IssueStatus" AS ENUM (
  'NEW',
  'SI_APPROVAL',
  'UNDER_REVIEW',
  'CLARIFICATION_REQUESTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'SI_REVIEW',
  'PENDING_CLIENT_APPROVAL',
  'CLOSED'
);

-- Step 4: Update the issues table column — no mapping needed for IN_QA
-- since no data was ever stored with that value (dead code path).
ALTER TABLE "issues"
  ALTER COLUMN "status" TYPE "IssueStatus"
    USING "status"::text::"IssueStatus";

-- Step 5: Re-add the default with the new enum type
ALTER TABLE "issues" ALTER COLUMN "status" SET DEFAULT 'NEW'::"IssueStatus";

-- Step 6: Drop the old enum
DROP TYPE "IssueStatus_old";
