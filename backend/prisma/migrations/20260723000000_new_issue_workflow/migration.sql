-- AlterEnum: Migrate IssueStatus to new branched workflow values

-- Step 1: Drop the default on the status column first
ALTER TABLE "issues" ALTER COLUMN "status" DROP DEFAULT;

-- Step 2: Rename the old enum
ALTER TYPE "IssueStatus" RENAME TO "IssueStatus_old";

-- Step 3: Create the new enum
CREATE TYPE "IssueStatus" AS ENUM (
  'NEW',
  'UNDER_REVIEW',
  'CLARIFICATION_REQUESTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'IN_QA',
  'SI_REVIEW',
  'PENDING_CLIENT_APPROVAL',
  'CLOSED'
);

-- Step 4: Update the issues table column, mapping old values to new ones
ALTER TABLE "issues"
  ALTER COLUMN "status" TYPE "IssueStatus"
    USING CASE "status"::text
      WHEN 'NEW'          THEN 'NEW'
      WHEN 'ACKNOWLEDGED' THEN 'UNDER_REVIEW'
      WHEN 'ASSIGNED'     THEN 'ASSIGNED'
      WHEN 'IN_PROGRESS'  THEN 'IN_PROGRESS'
      WHEN 'RESOLVED'     THEN 'PENDING_CLIENT_APPROVAL'
      WHEN 'VERIFIED'     THEN 'PENDING_CLIENT_APPROVAL'
      WHEN 'CLOSED'       THEN 'CLOSED'
      WHEN 'REOPENED'     THEN 'UNDER_REVIEW'
      ELSE 'NEW'
    END::"IssueStatus";

-- Step 5: Re-add the default with the new enum type
ALTER TABLE "issues" ALTER COLUMN "status" SET DEFAULT 'NEW'::"IssueStatus";

-- Step 6: Drop the old enum
DROP TYPE "IssueStatus_old";
