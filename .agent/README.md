# TaskPulse Session Bootstrap

Use this file when starting a new agent session in this workspace.

1. Read `AGENTS.md`.
2. Read the current user/system/deployment docs:
   `README.md`
   `docs/system/overview.md`
   `docs/deployment/deployment-guide.md`
3. Read the current implementation plan:
   `docs/superpowers/plans/2026-05-10-taskpulse-postgresql-project-version-foundation.md`
   `docs/superpowers/plans/2026-05-10-taskpulse-project-version-ai-ui.md`
4. Confirm whether the workspace has Git:
   `find . -maxdepth 2 -name .git -print`
5. Use PostgreSQL 17 locally:
   `docker compose -f deploy/local/docker-compose.postgres.yml up -d`
6. Verify before changing behavior:
   `pnpm test`
   `pnpm build`

Current local database URL:

```env
DATABASE_URL=postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public
```

If `localhost` fails, use `127.0.0.1` with the same port.

Docker PostgreSQL is intentionally exposed on host port `55432` because this machine already has another PostgreSQL process on `127.0.0.1:5432`.

Reset and reseed local demo data only when explicitly requested:

```bash
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api exec prisma migrate reset --force --skip-seed
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api seed
```

Current functional areas: project selector with blank/import/copy/archive, schedule versions, encrypted AI provider settings, real read-only AI chat, and user-facing task `displayId` values for UI/search. Do not implement AI schedule writes without preview, user confirmation, and pre-apply version save.

Keep private project data and AI keys out of responses and out of Git.
