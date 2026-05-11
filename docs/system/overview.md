# TaskPulse 系统说明文档

## 1. 系统定位

TaskPulse 是一个 AI 辅助项目日程管理系统。它以项目为核心组织任务、依赖、日程版本和 AI 分析，让用户可以在同一套数据上完成传统计划维护、外部 AI 自动化配置和系统内置 AI 问答分析。

系统当前重点是“可控的 AI 辅助”。AI 可以读取项目上下文、解释风险和提出建议，但不应绕过用户确认直接修改日程。后续 AI Apply 能力也应保持“预览 -> 用户确认 -> 保存版本 -> 应用”的边界。

## 2. 目标用户和使用方式

### 外部 AI / Agent 用户

适合希望通过 Codex、ChatGPT、Claude、企业 Agent 或脚本自动创建日程的人。外部 AI 可以调用 API 创建项目、写入任务、维护依赖、保存版本和查询当前计划。

### 传统项目管理用户

适合希望通过图形界面维护日程的人。用户可以在前端选择项目、导入 Excel、编辑任务、查看甘特图、维护依赖、保存 baseline 和恢复历史版本。

### 系统内置 AI 用户

适合希望在系统内直接询问当前项目状态、风险、延期原因和关键路径影响的人。AI Provider 由后端保存，前端只显示 masked key。

## 3. 总体架构

```text
apps/web
  Next.js 前端工作台
  项目选择、任务表格、甘特图、依赖编辑、版本管理、AI 配置和 AI 助手

apps/api
  NestJS API
  项目、任务、依赖、日程版本、AI Provider、AI Chat/Insight

packages/contracts
  前后端共享类型、DTO 和数据映射

PostgreSQL 17
  生产和本地开发数据库

deploy/local
  本地 PostgreSQL 17 Docker Compose

deploy/tencent
  腾讯云生产部署骨架
```

前端通过 `NEXT_PUBLIC_API_URL` 访问 API。API 通过 `DATABASE_URL` 连接 PostgreSQL，并使用 `APP_SECRET` 加密 AI Provider API Key。

## 4. 核心概念

### Project

项目是任务、依赖、版本和 AI 上下文的边界。当前前端顶部项目区域是真正的项目选择器，支持：

- 查看当前项目名称、状态和日期范围。
- 切换项目。
- 新建空白项目。
- 从 Excel 导入项目。
- 从已有项目复制项目。
- 归档项目。

当前项目 ID 保存在浏览器 `localStorage` 中。切换项目时，前端会清理搜索、选中任务和 AI 会话状态，并重新拉取任务和依赖。

### Task

任务是日程的基本单元，包含名称、日期、进度、状态、优先级、负责人、父子关系等字段。

任务有两类 ID：

- `id`：系统内部 UUID，用于数据库关联和 API 精确寻址。
- `displayId`：用户界面显示和搜索使用的任务编号，例如 `T-001`、`W-001`。

新建任务会自动生成当前项目内唯一的 `displayId`。Excel 导入任务也会生成导入任务编号。用户界面应优先展示和使用 `displayId`，不要把内部 UUID 当作用户操作编号。

### Dependency

依赖表示任务之间的先后关系，当前支持前置/后续任务关系维护。依赖数据用于甘特图、关键路径和 AI 风险分析。

### ScheduleVersion

日程版本用于保存完整项目快照。字段包括：

```ts
ScheduleVersion {
  id
  projectId
  name
  description
  type: manual | baseline | imported | auto
  snapshotJson
  isBaseline
  createdAt
}
```

当前已支持：

- 保存当前版本。
- 设置 baseline。
- 查看版本列表。
- 恢复版本。
- 恢复前自动保存当前状态为 rollback 版本。

后续计划支持版本对比，包括日期变化、新增/删除任务、依赖变化、父子关系变化和 critical path 变化。

### AIProviderConfig

AI Provider 配置保存在后端。字段包括：

```ts
AIProviderConfig {
  id
  name
  provider: openai-compatible | anthropic
  baseUrl
  model
  apiKeyEncrypted
  enabled
  isDefault
  createdAt
  updatedAt
}
```

关键规则：

- API Key 只存在后端。
- 前端只显示 masked key。
- 后端使用 `APP_SECRET` 加密 key。
- 支持测试连接。
- 支持 OpenAI-compatible provider。

## 5. 主要功能模块

### 项目管理

- 项目列表。
- 项目创建。
- Excel 导入。
- 项目复制。
- 项目归档。
- 当前项目本地持久化。

### 日程管理

- 任务创建、编辑、删除和批量更新。
- 任务搜索和选择。
- 任务父子关系。
- 依赖维护。
- 甘特图展示。
- 关键路径查询。

### 日程版本

- 保存当前快照。
- 设置 baseline。
- 恢复历史版本。
- 恢复前自动创建 rollback 快照。

### AI 配置和 AI 助手

- AI Provider 创建、启用、默认设置和测试连接。
- 当前项目上下文问答。
- 风险、延期、依赖和关键路径建议。
- AI 写入流程仍应通过后续 Apply 机制受控执行。

## 6. API 概览

### Projects

```text
GET    /projects
POST   /projects
POST   /projects/import
GET    /projects/:id
PATCH  /projects/:id
POST   /projects/:id/archive
POST   /projects/:id/duplicate
DELETE /projects/:id
```

### Tasks

```text
GET    /tasks?projectId=<projectId>
POST   /tasks
GET    /tasks/:id
PATCH  /tasks/:id
PATCH  /tasks/batch
DELETE /tasks/:id
GET    /tasks/critical-path/:projectId
```

### Dependencies

```text
GET    /dependencies?taskId=<taskId>
POST   /dependencies
GET    /dependencies/:id
PATCH  /dependencies/:id
DELETE /dependencies/:id
```

### Schedule Versions

```text
GET  /projects/:projectId/schedule-versions
POST /projects/:projectId/schedule-versions
POST /projects/:projectId/schedule-versions/:versionId/restore
```

### AI

```text
GET  /ai/providers
POST /ai/providers
POST /ai/providers/:id/test
POST /ai/providers/:id/default
POST /ai/chat
GET  /ai/history/:projectId
POST /ai/insights/:projectId
```

## 7. 数据安全和行为边界

- 不在前端保存原始 AI API Key。
- 不把生产数据库 dump、`.env`、原始密钥提交到仓库。
- AI 不直接修改日程。
- AI 修改建议必须可预览、可确认、可回滚。
- 任何破坏性数据操作前应确认目标数据库和连接串。

## 8. 当前限制和后续计划

当前仍需继续完善的方向：

- AI Apply：结构化变更、前端 diff、用户确认、保存版本、应用变更。
- 日程版本对比：任务、日期、依赖、父子关系和 critical path 变化。
- 用户认证、权限和审计。
- 更完整的生产运维脚本、备份恢复和监控告警。
- Excel 导入映射配置和导入前预览。
