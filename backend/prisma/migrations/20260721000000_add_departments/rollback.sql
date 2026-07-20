-- ============================================================
-- ROLLBACK: Department System
-- ============================================================
-- Run manually if needed: psql $DATABASE_URL -f rollback.sql
-- WARNING: This drops all department data permanently.
-- ============================================================

DROP TABLE IF EXISTS "project_departments";
DROP TABLE IF EXISTS "department_managers";
DROP TABLE IF EXISTS "departments";
ALTER TABLE "users" DROP COLUMN IF EXISTS "department_id";
ALTER TABLE "issues" DROP COLUMN IF EXISTS "assigned_to_department_id";
DROP INDEX IF EXISTS "issues_assigned_to_department_id_idx";
