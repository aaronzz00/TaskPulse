# TaskPulse

TaskPulse 是一个面向项目日程管理的工具。它把传统任务计划、项目版本快照和 AI 辅助分析放在同一个系统里，目标是让用户既能像使用普通项目管理工具一样维护日程，也能让外部 AI 或系统内置 AI 在受控边界内辅助配置、分析和调整计划。

## 三种使用方式

### 1. 通过其他 AI 使用 API 配置日程

如果你习惯使用 Codex、ChatGPT、Claude、企业内部 Agent 或其他自动化工具，可以让这些 AI 直接调用 TaskPulse 的 REST API 来创建项目、导入任务、维护依赖、保存版本和读取项目上下文。

推荐工作流：

1. 创建或选择项目。
2. 写入任务、父子关系和依赖关系。
3. 保存一个日程版本作为回滚点。
4. 让 AI 基于当前项目上下文生成建议。
5. 用户确认后，再通过 API 写入变更。

常用接口包括：

```bash
GET  /projects
POST /projects
POST /projects/import
POST /projects/:id/duplicate
POST /projects/:id/archive

GET  /tasks?projectId=<projectId>
POST /tasks
PATCH /tasks/:id
PATCH /tasks/batch

GET  /dependencies?taskId=<taskId>
POST /dependencies

GET  /projects/:projectId/schedule-versions
POST /projects/:projectId/schedule-versions
POST /projects/:projectId/schedule-versions/:versionId/restore

POST /ai/chat
POST /ai/insights/:projectId
```

界面中显示和搜索使用的是任务显示 ID，例如 `T-001`、`W-001`。数据库内部 UUID 仍然保留给系统关联使用。

### 2. 按传统日程管理工具使用

你也可以完全不使用 AI，把 TaskPulse 当作普通项目日程管理工具：

- 顶部项目选择器用于查看当前项目名称、状态和日期范围。
- 支持新建空白项目、从 Excel 导入项目、从已有项目复制项目。
- 支持归档项目。
- 支持任务列表、甘特图、依赖关系、父子任务、负责人、进度、优先级和状态管理。
- 支持用任务显示 ID 快速查找和定位任务。
- 支持保存当前版本、设置 baseline、查看版本列表和恢复历史版本。

切换项目时，系统会清理搜索、选中任务和 AI 会话状态，并重新拉取当前项目的任务和依赖。

### 3. 使用系统内置 AI 助手

系统内置 AI 助手用于围绕当前项目进行问答和风险分析。AI Provider 配置保存在后端，API Key 不会暴露给前端。

支持 OpenAI-compatible provider 和 Anthropic provider。OpenAI、Orka、DeepSeek、Qwen、腾讯混元等兼容 OpenAI API 的服务都可以通过 `baseUrl`、`model` 和 API Key 配置。

当前 AI 能力分层：

- Chat：围绕当前项目上下文问答。
- Insight：生成风险、延期、依赖和关键路径建议。
- Apply：规划中的受控写入流程，目标是让 AI 输出结构化变更，由前端展示 diff，用户确认后先保存版本再应用。

AI 不应直接修改日程。所有 AI 引发的日程变更都应走“预览 -> 用户确认 -> 保存版本 -> 应用”的流程。

## 本地快速启动

前置要求：

- Node.js 20+
- pnpm
- Docker
- 本机已有 `postgres:17` 镜像

安装依赖：

```bash
pnpm install
```

启动 PostgreSQL 17：

```bash
docker compose -f deploy/local/docker-compose.postgres.yml up -d
```

初始化数据库：

```bash
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api prisma:generate
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api prisma:migrate
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api seed
```

启动 API：

```bash
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" PORT=3001 TASKPULSE_CORS_ORIGIN=http://localhost:5173 pnpm --filter @taskpulse/api start
```

启动 Web：

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm --filter @taskpulse/web dev
```

打开：

```text
http://localhost:5173
```

如果本机 `localhost` 解析或 Docker 端口转发异常，可以把命令里的 `localhost` 改成 `127.0.0.1`。

## 主要目录

```text
apps/api              NestJS API、Prisma、PostgreSQL 数据模型
apps/web              Next.js 前端工作台
packages/contracts    前后端共享类型和映射
deploy/local          本地 PostgreSQL 17 Docker Compose
deploy/tencent        腾讯云部署配置和部署脚本
docs/system           系统说明文档
docs/deployment       部署说明文档
```

## 更多文档

- [系统说明文档](docs/system/overview.md)
- [系统部署方法说明文档](docs/deployment/deployment-guide.md)
- [后端集成指引](docs/integration/backend-integration-guideline.md)
- [前端改进指引](docs/integration/frontend-improvement-guideline.md)
- [系统测试计划](docs/testing/system-test-plan.md)

## 验证命令

```bash
pnpm test
pnpm build
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api exec prisma validate
```
