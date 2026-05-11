# TaskPulse System Test Plan

## Scope

This plan verifies the integrated TaskPulse monorepo after replacing the old frontend with the Next.js UI and connecting it to the NestJS backend.

## Test Environment

- API: `http://localhost:3001`
- Web: `http://localhost:5173`
- Local database: Docker PostgreSQL on `localhost:55432`
- Required env:
  - `DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public"` for API commands
  - `NEXT_PUBLIC_API_URL=http://localhost:3001` for web commands
  - `TASKPULSE_CORS_ORIGIN=http://localhost:5173` for the local API server

## Automated Checks

Run from the repository root:

```bash
pnpm test
pnpm build
pnpm --filter @taskpulse/api verify:local-data-privacy
```

Expected result: all commands exit with status 0.

## Database Setup

Preferred setup:

```bash
docker compose -f deploy/local/docker-compose.postgres.yml up -d
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api prisma:generate
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api prisma:migrate
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api seed
```

Import the local Whisper schedule workbook from outside this repository:

```bash
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api import:whisper -- /absolute/path/to/Whisper_Schedule_20260508.xlsx
```

## API Smoke Test

Start the API:

```bash
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" PORT=3001 TASKPULSE_CORS_ORIGIN=http://localhost:5173 pnpm --filter @taskpulse/api start
```

Verify projects:

```bash
curl -s http://localhost:3001/projects
```

Expected result: JSON array with at least one project.

Verify Whisper tasks:

```bash
curl -s "http://localhost:3001/tasks?projectId=whisper-20260508"
```

Expected result: JSON array with 102 imported Whisper tasks. Dependency rows are embedded in task `dependencies` arrays.

## Web Smoke Test

Start the frontend:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm --filter @taskpulse/web dev
```

Open `http://localhost:5173` and verify:

- Header shows `TaskPulse`.
- Project selector shows `Whisper`.
- Task list shows imported Whisper task titles.
- Task drawer date fields show separate planned start and planned end dates.
- Dependency controls show imported predecessor relationships.
- `/icons/favicon.ico` returns HTTP 200.

## Latest Local Verification

On May 10, 2026, the following checks passed after switching production/local development to PostgreSQL:

- `pnpm --filter @taskpulse/api test`: 20 tests passed.
- `pnpm --filter @taskpulse/web test`: 52 tests passed and compiled `@taskpulse/contracts` with `tsc -p ../../packages/contracts/tsconfig.json` before running.
- `pnpm test`: contracts, API, and web test pipeline passed.
- `pnpm build`: contracts, API, and Next.js production build passed.
- `DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api exec prisma validate`: Prisma schema valid.
- Whisper import validation: 102 tasks, 95 dependencies, 89 child tasks, 13 root tasks.
- Import report validation: date mismatches 0, hierarchy mismatches 0, dependency mismatches 0.
- Database date storage validation: 102 `plannedStart` and 102 `plannedEnd` values stored as RFC3339 text, non-RFC3339 rows 0.
