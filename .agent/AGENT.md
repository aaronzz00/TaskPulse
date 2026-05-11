# TaskPulse New Session Guide

This is the shortest handoff file for agents that look for `agent.md`-style instructions.

## Required Reading Order

1. `AGENTS.md`
2. `.agent/README.md`
3. `README.md`
4. `docs/system/overview.md`
5. `docs/deployment/deployment-guide.md`
6. Current plans:
   - `docs/superpowers/plans/2026-05-10-taskpulse-postgresql-project-version-foundation.md`
   - `docs/superpowers/plans/2026-05-10-taskpulse-project-version-ai-ui.md`

## Current Product Boundary

- TaskPulse is a pnpm/turbo monorepo.
- API: `apps/api`, NestJS, Prisma, PostgreSQL 17.
- Web: `apps/web`, Next.js workspace UI.
- Contracts: `packages/contracts`.
- Local PostgreSQL: `deploy/local/docker-compose.postgres.yml`, host port `55432`.

## Important Rules

- UI-facing task identifiers are `Task.displayId` values such as `T-001` and `W-001`.
- Internal task UUIDs are system IDs and should not be used as user-facing quick operation IDs.
- AI can chat and generate insights, but must not directly mutate schedule data.
- Future AI Apply work must use preview -> user confirmation -> save version -> apply.
- API keys stay backend-only. Frontend only shows masked keys.
- Do not commit `.env`, production dumps, raw AI keys, local backups, or source spreadsheets.

## Local Start

```bash
docker compose -f deploy/local/docker-compose.postgres.yml up -d
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api prisma:migrate
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" PORT=3001 TASKPULSE_CORS_ORIGIN=http://localhost:5173 pnpm --filter @taskpulse/api start
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm --filter @taskpulse/web dev
```

Use `127.0.0.1` instead of `localhost` if the environment cannot connect through `localhost`.
