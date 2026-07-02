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

### Running the Project

```bash
# 1. Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Start all services
docker compose -f docker/docker-compose.yml up --build
```

This starts:
- **PostgreSQL** on `localhost:5432`
- **Backend API** on `http://localhost:3000/api`
- **Frontend** on `http://localhost:5173`

### Verify

- Health check: `curl http://localhost:3000/api/health`
- Open `http://localhost:5173` in browser — you should see the dashboard showing API and database status.

### Run Migrations

```bash
docker exec -it issue-tracker-api npx prisma migrate dev
```

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
```
