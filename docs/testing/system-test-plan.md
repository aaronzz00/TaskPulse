# TaskPulse System Test Plan

## Scope

This plan verifies the integrated TaskPulse monorepo after replacing the old frontend with the Next.js UI and connecting it to the NestJS backend.

## Test Environment

- API: `http://localhost:3001`
- Web: `http://localhost:5173`
- Local database: `apps/api/prisma/dev.db`
- Required env:
  - `DATABASE_URL="file:./dev.db"` for API commands
  - `NEXT_PUBLIC_API_URL=http://localhost:3001` for web commands

## Automated Checks

Run from the repository root:

```bash
pnpm --filter @taskpulse/contracts test
pnpm --filter @taskpulse/api test
pnpm --filter @taskpulse/web test
pnpm build
```

Expected result: all commands exit with status 0.

## Database Setup

Preferred setup:

```bash
DATABASE_URL="file:./dev.db" pnpm --filter @taskpulse/api prisma:generate
DATABASE_URL="file:./dev.db" pnpm --filter @taskpulse/api prisma:migrate
DATABASE_URL="file:./dev.db" pnpm --filter @taskpulse/api seed
```

Fallback used on this machine when Prisma schema engine returned `Schema engine error`:

```bash
sqlite3 apps/api/prisma/dev.db < apps/api/prisma/migrations/20260505125951_init/migration.sql
DATABASE_URL="file:./dev.db" pnpm --filter @taskpulse/api seed
```

## API Smoke Test

Start the API:

```bash
DATABASE_URL="file:./dev.db" PORT=3001 pnpm --filter @taskpulse/api start
```

Verify projects:

```bash
curl -s http://localhost:3001/projects
```

Expected result: JSON array with at least one project.

Verify tasks:

```bash
curl -s "http://localhost:3001/tasks?projectId=<project-id>"
```

Expected result: JSON array with seeded tasks and dependency rows.

## Web Smoke Test

Start the frontend:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm --filter @taskpulse/web dev
```

Open `http://localhost:5173` and verify:

- Header shows `TaskPulse`.
- Project selector shows the seeded project name.
- Task list shows seeded task titles.
- `/icons/favicon.ico` returns HTTP 200.

## Latest Local Verification

On May 8, 2026, the following checks passed:

- `pnpm --filter @taskpulse/contracts test`: 2 tests passed.
- `pnpm --filter @taskpulse/api test`: 1 test passed.
- `pnpm --filter @taskpulse/web test`: 2 tests passed.
- `pnpm --filter @taskpulse/web build`: Next.js production build passed.
- API smoke: `/projects` returned 1 seeded project; `/tasks` returned 13 seeded tasks and 14 dependency rows.
- Browser smoke: the Next.js UI rendered `TaskPulse`, `网站重构项目`, and seeded task text.
- Icon smoke: `GET /icons/favicon.ico` returned HTTP 200 with `image/x-icon`.
