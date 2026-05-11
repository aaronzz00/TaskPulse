# TaskPulse Tencent Cloud Deployment

This directory contains the production deployment skeleton for a Tencent Cloud CVM.

## Requirements

- Ubuntu 22.04 or 24.04
- Docker Engine and Docker Compose
- Security group allows ports 80 and 443
- PostgreSQL is only exposed inside the Docker network

## Configure

Copy the example environment and replace every placeholder:

```bash
cp deploy/tencent/env.example deploy/tencent/.env
```

Add:

```env
TASKPULSE_DOMAIN=taskpulse.example.com
```

Keep `deploy/tencent/.env` out of Git.

## Start

From the repository root:

```bash
docker compose --env-file deploy/tencent/.env -f deploy/tencent/docker-compose.prod.yml up -d
```

Check service health:

```bash
docker compose --env-file deploy/tencent/.env -f deploy/tencent/docker-compose.prod.yml ps
```

## Migrations

The API container runs `prisma migrate deploy` before starting. For manual migration:

```bash
docker compose --env-file deploy/tencent/.env -f deploy/tencent/docker-compose.prod.yml run --rm api pnpm --filter @taskpulse/api prisma migrate deploy
```

## Backup

Create a compressed PostgreSQL backup:

```bash
docker compose --env-file deploy/tencent/.env -f deploy/tencent/docker-compose.prod.yml exec postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "taskpulse-$(date +%Y%m%d-%H%M%S).sql.gz"
```

Store backups outside the repository.
