# Local Real-Data Deployment Notes

> Legacy note: this document records the earlier SQLite local-data workflow. Current TaskPulse development and production verification use PostgreSQL through `deploy/local/docker-compose.postgres.yml` on host port `55432`.

## Goal

Whisper schedule data is real project data. Keep the source workbook and live database out of Git while still making the imported schedule available after deployment.

## Local Data Boundaries

- Source workbook: keep outside this repository, for example `/Users/zz-orka/zOS/20_WIKI/2026_Frame/Whisper_Schedule_20260508.xlsx`.
- Local SQLite database: `apps/api/prisma/dev.db`; this is ignored by Git.
- Import reports and local backups: `.local-backups/`; this is ignored by Git.
- Repository guard: `pnpm --filter @taskpulse/api verify:local-data-privacy` fails if a `Whisper_Schedule_*.xlsx` workbook is copied into the repository or required ignore rules are missing.

## Import Command

Run from the repository root:

```bash
DATABASE_URL="file:./dev.db" pnpm --filter @taskpulse/api import:whisper -- /absolute/path/to/Whisper_Schedule_20260508.xlsx
```

The importer replaces the `whisper-20260508` project, writes parent-child relationships from indentation, writes dependencies from `Predecessors`, fills approved missing dates, and stores a local report at `.local-backups/whisper-import-report.json`.

## Deployment Persistence

For the current SQLite deployment path, persist the database file outside the release bundle:

```text
TASKPULSE_DATA_DIR=/var/lib/taskpulse
DATABASE_URL=file:/var/lib/taskpulse/dev.db
```

Mount `TASKPULSE_DATA_DIR` as a persistent volume in production. Deploying a new application build should replace code only; it should not overwrite the database volume.

Before deployment or upgrade, back up the current database:

```bash
sqlite3 apps/api/prisma/dev.db ".backup '.local-backups/taskpulse-$(date +%Y%m%d%H%M%S).db'"
```

To restore a backed-up database, stop the API, copy the backup over the deployment database path, and start the API again.

## Privacy Checklist

Run these before publishing or packaging a release:

```bash
pnpm --filter @taskpulse/api verify:local-data-privacy
find . -name 'Whisper_Schedule_*.xlsx' -not -path './.local-backups/*' -not -path './node_modules/*'
```

The first command should return `"ok": true`. The second command should return no source workbook paths.
