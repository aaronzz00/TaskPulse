# PostgreSQL Deployment Notes

TaskPulse production uses PostgreSQL through Prisma.

Required environment:

```env
DATABASE_URL=postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public
APP_SECRET=replace-with-32-byte-secret
```

On this machine, local Docker PostgreSQL is exposed on host port `55432` because another PostgreSQL process already listens on `127.0.0.1:5432`.

Local SQLite data in `apps/api/prisma/dev.db` is development/private data and is not the production contract.

Do not commit production `.env` files, database dumps, local `.db` files, source Excel schedules, or generated backups.
