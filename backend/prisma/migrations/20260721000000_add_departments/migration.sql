-- ============================================================
-- Migration: Add Department System
-- ============================================================
-- SAFETY: All changes are additive (new tables, nullable columns).
-- No existing data is modified or deleted.
-- Data migration is idempotent (safe to re-run).
-- ============================================================

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_managers" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_departments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_name_key" ON "departments"("organization_id", "name");
CREATE INDEX "departments_organization_id_idx" ON "departments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_managers_department_id_user_id_key" ON "department_managers"("department_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_departments_project_id_department_id_key" ON "project_departments"("project_id", "department_id");

-- AlterTable: Add department_id to users and assigned_to_department_id to issues
ALTER TABLE "users" ADD COLUMN "department_id" TEXT;
ALTER TABLE "issues" ADD COLUMN "assigned_to_department_id" TEXT;

-- CreateIndex
CREATE INDEX "issues_assigned_to_department_id_idx" ON "issues"("assigned_to_department_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_managers" ADD CONSTRAINT "department_managers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_managers" ADD CONSTRAINT "department_managers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_departments" ADD CONSTRAINT "project_departments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_departments" ADD CONSTRAINT "project_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_assigned_to_department_id_fkey" FOREIGN KEY ("assigned_to_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- DATA MIGRATION (idempotent)
-- ============================================================

-- 1. Create IT department for each non-SUPER_ADMIN org
INSERT INTO "departments" ("id", "name", "organization_id", "createdAt")
SELECT gen_random_uuid(), 'IT', "id", CURRENT_TIMESTAMP
FROM "organizations" o
WHERE "type" != 'SUPER_ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "departments" d
    WHERE d."organization_id" = o."id" AND d."name" = 'IT'
  );

-- 2. Assign all USER-role users to their org's IT department
UPDATE "users" u
SET "department_id" = d."id"
FROM "departments" d
WHERE u."organization_id" = d."organization_id"
  AND d."name" = 'IT'
  AND u."role" = 'USER'
  AND u."department_id" IS NULL
  AND u."email" NOT LIKE 'deleted-%';

-- 3. Make all ORG_ADMIN users managers of their org's IT department
INSERT INTO "department_managers" ("id", "department_id", "user_id", "createdAt")
SELECT gen_random_uuid(), d."id", u."id", CURRENT_TIMESTAMP
FROM "users" u
JOIN "departments" d ON d."organization_id" = u."organization_id" AND d."name" = 'IT'
WHERE u."role" = 'ORG_ADMIN'
  AND u."email" NOT LIKE 'deleted-%'
  AND NOT EXISTS (
    SELECT 1 FROM "department_managers" dm
    WHERE dm."department_id" = d."id" AND dm."user_id" = u."id"
  );

-- 4. Add all departments from project-member orgs to existing projects
INSERT INTO "project_departments" ("id", "project_id", "department_id", "createdAt")
SELECT gen_random_uuid(), po."project_id", d."id", CURRENT_TIMESTAMP
FROM "project_organizations" po
JOIN "departments" d ON d."organization_id" = po."organization_id"
ON CONFLICT ("project_id", "department_id") DO NOTHING;
