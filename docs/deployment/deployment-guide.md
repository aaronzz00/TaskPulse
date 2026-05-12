# TaskPulse 系统部署方法说明文档

## 1. 部署组成

TaskPulse 部署包含三个核心部分：

- PostgreSQL 17：保存项目、任务、依赖、版本和 AI 配置。
- API 服务：`apps/api`，NestJS + Prisma。
- Web 服务：`apps/web`，Next.js 前端。

本地开发推荐使用 `deploy/local/docker-compose.postgres.yml` 只启动 PostgreSQL，然后在本机分别启动 API 和 Web。生产部署推荐使用 `deploy/tencent/docker-compose.prod.yml`，并可通过 GitHub Actions SSH 自动部署到腾讯云 CVM 或 Lighthouse。

## 2. 本地开发部署

### 前置要求

- Node.js 20+
- pnpm
- Docker
- 本机已有 `postgres:17` 镜像

### 安装依赖

```bash
pnpm install
```

### 启动 PostgreSQL 17

```bash
docker compose -f deploy/local/docker-compose.postgres.yml up -d
```

本地 Compose 默认配置：

```text
container: taskpulse-postgres
image: postgres:17
database: taskpulse
user: taskpulse
password: taskpulse
host port: 55432
container port: 5432
```

### 初始化数据库

```bash
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api prisma:generate
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api prisma:migrate
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api seed
```

如果 `localhost` 连接异常，可改用：

```text
postgresql://taskpulse:taskpulse@127.0.0.1:55432/taskpulse?schema=public
```

### 启动 API

```bash
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" PORT=3001 TASKPULSE_CORS_ORIGIN=http://localhost:5173 pnpm --filter @taskpulse/api start
```

### 启动 Web

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm --filter @taskpulse/web dev
```

访问：

```text
http://localhost:5173
```

## 3. 常用环境变量

### API

```text
DATABASE_URL              PostgreSQL 连接串
PORT                      API 监听端口，默认本地使用 3001
TASKPULSE_CORS_ORIGIN     允许访问 API 的前端地址
APP_SECRET                加密 AI Provider API Key 的应用密钥
```

`APP_SECRET` 在配置 AI Provider 前必须稳定设置。生产环境不要使用临时值，否则历史加密 key 可能无法解密。

### Web

```text
NEXT_PUBLIC_API_URL       浏览器访问 API 的地址
```

### AI Provider

推荐通过系统 UI 或 API 写入 `AIProviderConfig`，不要把 provider API Key 写入前端环境变量。API Key 会在后端加密保存，前端只显示 masked key。

## 4. 数据库维护

### 校验 Prisma Schema

```bash
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api exec prisma validate
```

### 应用迁移

开发环境：

```bash
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api prisma:migrate
```

生产或类生产环境：

```bash
DATABASE_URL="<production-database-url>" pnpm --filter @taskpulse/api exec prisma migrate deploy
```

### 清空并重建本地演示数据

这会删除当前连接数据库中的数据，仅用于本地开发和测试：

```bash
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api exec prisma migrate reset --force --skip-seed
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api seed
```

### 备份和恢复

备份：

```bash
docker exec taskpulse-postgres pg_dump -U taskpulse -d taskpulse > taskpulse-backup.sql
```

恢复前应确认目标数据库可以被覆盖：

```bash
docker exec -i taskpulse-postgres psql -U taskpulse -d taskpulse < taskpulse-backup.sql
```

不要把生产备份文件提交到仓库。

## 5. 腾讯云生产部署

生产部署文件位于：

```text
deploy/tencent/docker-compose.prod.yml
deploy/tencent/Caddyfile
deploy/tencent/env.example
deploy/tencent/deploy.sh
```

### 5.1 服务器要求

- Tencent Cloud CVM 或 Lighthouse
- Ubuntu 22.04 或 24.04
- Docker Engine 和 Docker Compose
- 安全组开放 `80` 和 `443`
- 仓库可被服务器拉取。如果仓库为 public，服务器无需 GitHub deploy key。

生产 Compose 会启动：

- `postgres`：PostgreSQL 17，仅在 Docker 网络内暴露。
- `api`：NestJS API，启动前会生成 Prisma client、应用迁移并构建 API。
- `web`：Next.js Web，容器内构建并启动。
- `proxy`：Caddy，负责域名、HTTPS 和 `/api/*` 反向代理。

### 5.2 首次服务器初始化

在服务器上安装 Docker 后，克隆仓库到固定目录：

```bash
git clone https://github.com/aaronzz00/TaskPulse.git /opt/taskpulse
cd /opt/taskpulse
cp deploy/tencent/env.example deploy/tencent/.env
```

编辑服务器上的 `deploy/tencent/.env`。至少包含：

```text
POSTGRES_DB=taskpulse
POSTGRES_USER=taskpulse
POSTGRES_PASSWORD=<strong-password>

DATABASE_URL=postgresql://taskpulse:<strong-password>@postgres:5432/taskpulse?schema=public
APP_SECRET=<long-random-secret>
TASKPULSE_CORS_ORIGIN=https://<your-domain>

NEXT_PUBLIC_API_URL=https://<your-domain>/api
TASKPULSE_DOMAIN=<your-domain>
```

`deploy/tencent/.env` 只保存在服务器，不提交到 Git。

首次启动：

```bash
bash deploy/tencent/deploy.sh
```

等价的手动 Compose 命令：

```bash
docker compose --env-file deploy/tencent/.env -f deploy/tencent/docker-compose.prod.yml up -d --build --remove-orphans
```

API 容器启动时会自动执行 `prisma migrate deploy`。如需手动迁移：

```bash
docker compose --env-file deploy/tencent/.env -f deploy/tencent/docker-compose.prod.yml run --rm api pnpm --filter @taskpulse/api prisma migrate deploy
```

查看日志：

```bash
docker compose --env-file deploy/tencent/.env -f deploy/tencent/docker-compose.prod.yml logs -f api
docker compose --env-file deploy/tencent/.env -f deploy/tencent/docker-compose.prod.yml logs -f web
docker compose --env-file deploy/tencent/.env -f deploy/tencent/docker-compose.prod.yml logs -f proxy
```

查看服务状态：

```bash
docker compose --env-file deploy/tencent/.env -f deploy/tencent/docker-compose.prod.yml ps
```

### 5.3 GitHub Actions SSH 自动部署

短期最简单的自动部署方案是 GitHub Actions 通过 SSH 登录腾讯云服务器，在服务器上拉取最新 `main` 并运行 `deploy/tencent/deploy.sh`。

已提供 workflow：

```text
.github/workflows/deploy-tencent-ssh.yml
```

触发方式：

- push 到 `main`
- 在 GitHub Actions 页面手动运行 `workflow_dispatch`

GitHub workflow 会：

1. Checkout 仓库。
2. 启用 pnpm 并安装依赖。
3. 运行 `pnpm test`。
4. 运行 `pnpm build`。
5. 通过 SSH 登录腾讯云服务器。
6. 在 `TENCENT_DEPLOY_PATH` 下执行：

```bash
git fetch origin main
git checkout main
git reset --hard origin/main
bash deploy/tencent/deploy.sh
```

### 5.4 GitHub Secrets

建议创建 GitHub Environment：`production`，并配置以下 secrets：

```text
TENCENT_HOST=your-server-public-ip-or-domain
TENCENT_USER=ubuntu
TENCENT_SSH_KEY=private SSH key with access to the server
TENCENT_DEPLOY_PATH=/opt/taskpulse
```

`TENCENT_SSH_KEY` 建议使用专用部署密钥。把对应 public key 写入服务器用户的 `~/.ssh/authorized_keys`。

服务器上的部署目录会被 `git reset --hard origin/main` 覆盖。不要在该目录中保留手工源码修改；生产配置、数据库数据和备份应放在 Git 忽略路径或 Docker volume 中。

### 5.5 生产备份

创建 PostgreSQL 压缩备份：

```bash
docker compose --env-file deploy/tencent/.env -f deploy/tencent/docker-compose.prod.yml exec postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "taskpulse-$(date +%Y%m%d-%H%M%S).sql.gz"
```

备份文件应存储在仓库外部，且不要提交到 Git。

## 6. 发布检查清单

发布前检查：

- `pnpm test` 通过。
- `pnpm build` 通过。
- Prisma schema validate 通过。
- 生产 `APP_SECRET` 已设置且不会频繁变化。
- `TASKPULSE_CORS_ORIGIN` 与真实前端域名一致。
- `NEXT_PUBLIC_API_URL` 是浏览器可访问的 API 地址。
- 已确认数据库备份策略。
- 未提交 `.env`、生产 dump、原始 AI API Key。

## 7. 故障排查

### API 连接不上数据库

检查 PostgreSQL 容器状态：

```bash
docker ps --filter name=taskpulse-postgres
```

检查端口：

```bash
docker port taskpulse-postgres
```

本地开发默认应为：

```text
5432/tcp -> 0.0.0.0:55432
```

### Web 无法访问 API

确认：

- API 已启动在 `PORT=3001`。
- Web 的 `NEXT_PUBLIC_API_URL` 指向正确地址。
- API 的 `TASKPULSE_CORS_ORIGIN` 包含当前 Web 地址。

### AI Provider 测试失败

确认：

- Provider 类型正确。
- OpenAI-compatible provider 的 `baseUrl` 包含正确 API 路径。
- Model 名称可用。
- API Key 未过期。
- API 服务运行时设置了稳定的 `APP_SECRET`。

### 端口冲突

本地 PostgreSQL 默认使用宿主机 `55432`，避免和系统已有 PostgreSQL 的 `5432` 冲突。API 默认使用 `3001`，Web 默认使用 `5173`。如果端口被占用，可调整环境变量或 Compose 端口映射。
