# TaskPulse

TaskPulse is an AI-assisted project planning system with a NestJS API, Prisma persistence, and a Next.js workspace UI for task trees, Gantt scheduling, dependencies, and schedule risk workflows.

## Repository Layout

```text
apps/
  api/          NestJS API, Prisma schema, migrations, seed data
  web/          Next.js frontend
packages/
  contracts/   Shared API/UI contracts and mapping helpers
assets/
  icons/        Source icon assets used by the web app
docs/
  integration/ Frontend/backend integration guidelines
  testing/     System test plan
```

## Prerequisites

- Node.js 20 or newer
- pnpm 8.x
- SQLite for local smoke testing

## Setup

```bash
pnpm install
DATABASE_URL="file:./dev.db" pnpm --filter @taskpulse/api prisma:generate
DATABASE_URL="file:./dev.db" pnpm --filter @taskpulse/api prisma:migrate
DATABASE_URL="file:./dev.db" pnpm --filter @taskpulse/api seed
```

If Prisma schema engine fails locally, apply the checked-in SQLite migration directly:

```bash
sqlite3 apps/api/prisma/dev.db < apps/api/prisma/migrations/20260505125951_init/migration.sql
DATABASE_URL="file:./dev.db" pnpm --filter @taskpulse/api seed
```

## Development

Run the backend:

```bash
DATABASE_URL="file:./dev.db" PORT=3001 pnpm --filter @taskpulse/api start
```

Run the frontend:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm --filter @taskpulse/web dev
```

Open `http://localhost:5173`.

## Verification

```bash
pnpm --filter @taskpulse/contracts test
pnpm --filter @taskpulse/api test
pnpm --filter @taskpulse/web test
pnpm build
```

System smoke checks are documented in `docs/testing/system-test-plan.md`.
