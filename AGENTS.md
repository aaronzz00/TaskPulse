# TaskPulse Agent Guide

## Read First

Before continuing development in a new session, read these files:

- `README.md`: user-facing usage guide and three operating modes.
- `docs/system/overview.md`: architecture, domain model, API overview, and current behavior boundaries.
- `docs/deployment/deployment-guide.md`: local and production deployment commands.
- `docs/superpowers/specs/2026-05-09-taskpulse-productization-postgresql-ai-deployment-design.md`
- `docs/superpowers/plans/2026-05-10-taskpulse-postgresql-project-version-foundation.md`
- `docs/superpowers/plans/2026-05-10-taskpulse-project-version-ai-ui.md`

## Current Direction

TaskPulse is now a pnpm/turbo monorepo with:

- `apps/api`: NestJS API, Prisma, PostgreSQL production/local development schema.
- `apps/web`: Next.js workspace UI.
- `packages/contracts`: shared API/UI types and mappers.
- `deploy/local/docker-compose.postgres.yml`: local PostgreSQL 17.
- `deploy/tencent`: Tencent Cloud production deployment skeleton.

The active productization design is:

- `docs/superpowers/specs/2026-05-09-taskpulse-productization-postgresql-ai-deployment-design.md`
- `docs/superpowers/plans/2026-05-10-taskpulse-postgresql-project-version-foundation.md`
- `docs/superpowers/plans/2026-05-10-taskpulse-project-version-ai-ui.md`

Current implemented surface includes project switching/creation/import/copy/archive, schedule version save/baseline/list/restore, encrypted AI provider configuration, and real read-only AI chat.

User-facing task IDs are stored in `Task.displayId` and shown as values such as `T-001` or `W-001`. UI search and quick operations should use `displayId`; internal UUIDs remain system IDs for database/API identity.

AI schedule mutation must still use a future preview -> confirm -> version save -> apply workflow. API keys must stay backend-only, and the frontend may show masked keys only.

## Start Commands

Start local PostgreSQL:

```bash
docker compose -f deploy/local/docker-compose.postgres.yml up -d
```

Initialize the database:

```bash
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api prisma:generate
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api prisma:migrate
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api seed
```

If `localhost` fails in the current environment, use `127.0.0.1` with the same port.

Start API:

```bash
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" PORT=3001 TASKPULSE_CORS_ORIGIN=http://localhost:5173 pnpm --filter @taskpulse/api start
```

Start web:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm --filter @taskpulse/web dev
```

Open `http://localhost:5173`.

## Verification

```bash
pnpm test
pnpm build
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api exec prisma validate
```

When changing Prisma schema, also run generate/migrate against the local PostgreSQL 17 database before testing API behavior.

Note: this project maps Docker PostgreSQL to host port `55432` because this machine already has another PostgreSQL process listening on `127.0.0.1:5432`.

## Data Safety

Do not commit:

- `.env` files
- `apps/api/prisma/dev.db`
- `.local-backups/*`
- `Whisper_Schedule_*.xlsx`
- production database dumps
- raw AI provider keys

The current working directory is not a Git repository. Confirm Git setup before attempting worktrees, commits, or pushes.
