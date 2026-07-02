import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test when running tests
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

// Safety check: fail loudly if DATABASE_URL during tests matches the dev database
const devDbUrl = 'postgresql://postgres:postgres@localhost:5432/issue_tracker?schema=public';
const testDbUrl = process.env.DATABASE_URL;

if (!testDbUrl) {
  throw new Error(
    'FATAL: DATABASE_URL is not set. Tests require a separate test database. ' +
    'Create a .env.test file with DATABASE_URL pointing to your test database ' +
    '(e.g., postgresql://postgres:postgres@localhost:5432/issue_tracker_test?schema=public). ' +
    'See .env.test.example for reference.',
  );
}

if (testDbUrl === devDbUrl) {
  throw new Error(
    'FATAL: Tests are configured to use the DEV database! ' +
    'This would destroy all seed data. ' +
    'Set DATABASE_URL in .env.test to point to a separate test database ' +
    '(e.g., postgresql://postgres:postgres@localhost:5432/issue_tracker_test?schema=public).',
  );
}

console.log(`[jest.setup] Using test database: ${testDbUrl}`);