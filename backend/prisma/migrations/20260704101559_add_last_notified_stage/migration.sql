-- CreateEnum
CREATE TYPE "NotifiedStage" AS ENUM ('NONE', 'WARNING_SENT', 'OVERDUE_SENT');

-- DropForeignKey
ALTER TABLE "issue_assignees" DROP CONSTRAINT "issue_assignees_assigned_by_id_fkey";

-- DropForeignKey
ALTER TABLE "issue_assignees" DROP CONSTRAINT "issue_assignees_issue_id_fkey";

-- DropForeignKey
ALTER TABLE "issue_assignees" DROP CONSTRAINT "issue_assignees_user_id_fkey";

-- DropIndex
DROP INDEX "issues_assigned_to_user_id_idx";

-- AlterTable
ALTER TABLE "issue_assignees" DROP COLUMN "assigned_at",
ADD COLUMN     "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "last_notified_stage" "NotifiedStage" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "resolution_note" TEXT,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "resolved_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignees_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
