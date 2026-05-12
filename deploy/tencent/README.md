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

## GitHub Actions SSH Auto-Deploy

For the quickest production workflow, GitHub Actions can deploy to one Tencent Cloud CVM or Lighthouse server over SSH after every push to `main`.

### One-Time Server Setup

Install Docker and Docker Compose, then clone the repository:

```bash
git clone https://github.com/aaronzz00/TaskPulse.git /opt/taskpulse
cd /opt/taskpulse
cp deploy/tencent/env.example deploy/tencent/.env
```

Edit `deploy/tencent/.env` on the server. Keep this file on the server only.

Run the first deployment manually:

```bash
bash deploy/tencent/deploy.sh
```

### GitHub Secrets

Create a GitHub Environment named `production`, then add these secrets:

```text
TENCENT_HOST=your-server-public-ip-or-domain
TENCENT_USER=ubuntu
TENCENT_SSH_KEY=private SSH key with access to the server
TENCENT_DEPLOY_PATH=/opt/taskpulse
```

The deployment key should be a dedicated SSH key. Add its public key to the server user's `~/.ssh/authorized_keys`.

### Deployment Behavior

`.github/workflows/deploy-tencent-ssh.yml` runs on every push to `main` and can also be started manually from GitHub Actions. It:

1. Installs dependencies.
2. Runs `pnpm test`.
3. Runs `pnpm build`.
4. SSHes to the Tencent server.
5. Resets the server checkout to `origin/main`.
6. Runs `deploy/tencent/deploy.sh`.

The server checkout is treated as deployment output. Do not keep manual source edits in that directory.
