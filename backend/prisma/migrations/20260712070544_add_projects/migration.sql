-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "project_id" TEXT;

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_organizations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_users" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "added_by_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_name_key" ON "projects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "project_organizations_project_id_organization_id_key" ON "project_organizations"("project_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_users_project_id_user_id_key" ON "project_users"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "issues_project_id_idx" ON "issues"("project_id");

-- AddForeignKey
ALTER TABLE "project_organizations" ADD CONSTRAINT "project_organizations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_organizations" ADD CONSTRAINT "project_organizations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_users" ADD CONSTRAINT "project_users_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_users" ADD CONSTRAINT "project_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_users" ADD CONSTRAINT "project_users_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- DATA MIGRATION: Create "NRB Bank CBS Upgrade" project
-- and backfill all existing issues, orgs, and users
-- ============================================================

-- 1. Create the default project
INSERT INTO "projects" ("id", "name", "description", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'NRB Bank CBS Upgrade', 'Default project for all existing issues', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 2. Add all non-SUPER_ADMIN organizations to the project
INSERT INTO "project_organizations" ("id", "project_id", "organization_id", "createdAt")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001', "id", CURRENT_TIMESTAMP
FROM "organizations"
WHERE "type" != 'SUPER_ADMIN';

-- 3. Add all non-deleted users to the project
INSERT INTO "project_users" ("id", "project_id", "user_id", "createdAt")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001', "id", CURRENT_TIMESTAMP
FROM "users"
WHERE "email" NOT LIKE 'deleted-%';

-- 4. Tag all existing issues with the default project
UPDATE "issues" SET "project_id" = '00000000-0000-0000-0000-000000000001' WHERE "project_id" IS NULL;

-- 5. Make project_id NOT NULL now that all rows have a value
ALTER TABLE "issues" ALTER COLUMN "project_id" SET NOT NULL;
