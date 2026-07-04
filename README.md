# Issue Tracker

Multi-tenant issue tracking system built with NestJS, React, PostgreSQL, and Prisma.

## Tech Stack

- **Backend:** Node.js, NestJS, TypeScript, Prisma ORM
- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Database:** PostgreSQL 15
- **Infra:** Docker Compose

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- Stop any local PostgreSQL service (Docker runs its own)

### Running the Project

```bash
# Start all services (builds images, runs migrations automatically)
./start.sh
```

Or manually:

```bash
# 1. Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Start all services (migrations run automatically on startup)
docker compose -f docker/docker-compose.yml up --build -d
```

This starts:
- **PostgreSQL** (internal — not exposed to host to avoid port conflicts)
- **Backend API** on `http://localhost:3000/api`
- **Frontend** on `http://localhost:5173`

### Verify

- Health check: `curl http://localhost:3000/api/health`
- Open `http://localhost:5173` in browser — you should see the dashboard showing API and database status.

### Seed Data

```bash
# Run seed to create 4 orgs and 8 users (all passwords: password123)
docker exec issue-tracker-api npx prisma db seed
```

## Running Tests

Integration tests require a **separate test database** to prevent data loss.

### One-time Setup

```bash
# 1. Create the test database (PostgreSQL must be running)
createdb issue_tracker_test

# Or via psql:
# PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE issue_tracker_test;"

# 2. Copy the test environment file
cp backend/.env.test.example backend/.env.test

# 3. Run migrations on the test database
cd backend && npx dotenv -e .env.test -- npx prisma migrate deploy
```

### Run Tests

```bash
cd backend
npm test            # run all tests against issue_tracker_test
npm run test:watch  # watch mode
```

The test setup automatically:
1. Loads `.env.test` (separate `DATABASE_URL` for the test DB)
2. **Fails loudly** if `DATABASE_URL` accidentally points to the dev database
3. Migrations are applied via the `pretest` script

## Project Structure

```
├── backend/               # NestJS API
│   ├── prisma/            # Prisma schema & migrations
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   └── modules/
│   │       ├── prisma/
│   │       ├── health/
│   │       ├── users/
│   │       ├── auth/
│   │       ├── issues/
│   │       ├── organizations/
│   │       ├── attachments/
│   │       └── notifications/
│   ├── Dockerfile
│   ├── docker-entrypoint.sh  # Runs migrations before starting the app
│   ├── jest.setup.ts      # Loads .env.test + safety assertion
│   ├── .env.test.example  # Test DB env template
│   └── .env.example
├── frontend/              # React SPA
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── context/
│   │   └── App.tsx
│   ├── Dockerfile
│   └── .env.example
└── docker/
    └── docker-compose.yml