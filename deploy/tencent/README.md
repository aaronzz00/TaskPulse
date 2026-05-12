# TaskPulse Tencent Deployment Files

This directory contains the Tencent Cloud Docker Compose, Caddy, environment example, and deploy script files.

The canonical deployment guide is:

```text
docs/deployment/deployment-guide.md
```

Start production services from the repository root:

```bash
cp deploy/tencent/env.example deploy/tencent/.env
bash deploy/tencent/deploy.sh
```

Keep `deploy/tencent/.env` and database backups out of Git.
