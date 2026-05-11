# TaskPulse 系统部署方法说明文档

## 1. 部署组成

TaskPulse 部署包含三个核心部分：

- PostgreSQL 17：保存项目、任务、依赖、版本和 AI 配置。
- API 服务：`apps/api`，NestJS + Prisma。
- Web 服务：`apps/web`，Next.js 前端。

本地开发推荐使用 `deploy/local/docker-compose.postgres.yml` 只启动 PostgreSQL，然后在本机分别启动 API 和 Web。生产部署可参考 `deploy/tencent/docker-compose.prod.yml`。

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

## 5. 生产部署参考

生产部署骨架位于：

```text
deploy/tencent/docker-compose.prod.yml
```

推荐在服务器上准备 `.env`，至少包含：

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

启动：

```bash
docker compose -f deploy/tencent/docker-compose.prod.yml up -d
```

首次部署后应用迁移：

```bash
docker compose -f deploy/tencent/docker-compose.prod.yml exec api pnpm --filter @taskpulse/api exec prisma migrate deploy
```

查看日志：

```bash
docker compose -f deploy/tencent/docker-compose.prod.yml logs -f api
docker compose -f deploy/tencent/docker-compose.prod.yml logs -f web
docker compose -f deploy/tencent/docker-compose.prod.yml logs -f proxy
```

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
