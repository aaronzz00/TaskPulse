# TaskPulse Productization, PostgreSQL, AI, and Deployment Design

## Goal

Move TaskPulse from a local single-project planning tool toward a production-usable system for real project schedules. The next stage adds project creation and switching, schedule version control, configurable AI providers, and a Tencent Cloud deployment path backed by PostgreSQL.

The design keeps the current monorepo shape and existing Gantt workflow. It avoids heavy multi-tenant or enterprise permission features until the core data lifecycle is reliable.

## Current Context

The repository currently contains:

- `apps/api`: NestJS API with Prisma, projects, tasks, dependencies, insights, and early AI routes.
- `apps/web`: Next.js frontend with a single loaded project, Gantt interactions, search, dependency display modes, task IDs, and critical path visualization.
- `packages/contracts`: shared API/frontend mapping contracts.
- `apps/api/prisma/dev.db`: local SQLite database containing real Whisper project data.

The API already has basic `Project`, `Task`, `Dependency`, `AIInsight`, and `User` models. Project routes exist, but the frontend currently selects the first available project by default. AI backend code supports environment-based OpenAI/Anthropic clients, while the frontend AI sidebar is still mock-driven.

The user selected PostgreSQL as the production database. Local SQLite may remain useful for fast development, but production deployment and acceptance testing should target PostgreSQL.

## Architecture Direction

TaskPulse remains a pnpm/turbo monorepo:

```text
apps/
  api/          NestJS API, Prisma schema, migrations, import/export scripts
  web/          Next.js frontend
packages/
  contracts/   shared API/frontend types and mappers
deploy/
  tencent/      production deployment scripts and compose files
docs/
  deployment/  deployment and recovery instructions
```

Production runs on Tencent Cloud CVM with Docker Compose:

```text
Caddy or Nginx
  -> apps/web
  -> apps/api
       -> PostgreSQL
```

PostgreSQL is the production source of truth. API keys and AI settings are stored in the database with encrypted secrets. Real project schedule files stay outside Git; imports write only normalized records into the database.

## Database Strategy

Production uses PostgreSQL. The Prisma datasource should be compatible with PostgreSQL migrations and production deployment. If local SQLite support is retained, it should be treated as a development convenience and not as the production contract.

Recommended path:

- Add a production PostgreSQL migration path.
- Test migrations against PostgreSQL in CI or local Docker.
- Keep a documented data migration/export path from the existing SQLite database to PostgreSQL.
- Avoid committing real `.db`, `.xlsx`, backup dumps, or generated production `.env` files.

The existing Whisper data must be migrated or re-imported into PostgreSQL without placing the source workbook in the repository.

## Project Creation And Switching

### User Flow

The top project selector becomes a real control instead of a passive label:

- Shows current project name, status, and date range.
- Opens a project switcher with recent projects and search/filter.
- Provides actions for creating, duplicating, importing, archiving, and opening projects.
- Persists the last selected project ID in `localStorage`.

When a project changes, the frontend resets project-scoped UI state:

- selected task
- search query and active search result
- expanded search-derived rows
- dependency display selection context
- AI conversation state

It then reloads the project overview, tasks, dependencies, and insights.

### New Project Modes

First implementation should support:

- blank project
- duplicate current project
- import from Excel

Blank project creates only the `Project` row. Duplicate project copies tasks, dependencies, hierarchy, and optionally the current baseline. Excel import should create a new project or import into an explicitly selected empty project.

### Backend API

Existing endpoints remain:

- `GET /projects`
- `GET /projects/:id`
- `POST /projects`
- `PATCH /projects/:id`
- `DELETE /projects/:id`

Recommended additions:

- `POST /projects/:id/archive`
- `POST /projects/:id/duplicate`
- `POST /projects/import` or a dedicated upload/import route

Deletion should be limited or hidden in the first production version. Archive is safer for real project data.

## Schedule Version Control

### Model

Add a schedule snapshot model:

```text
ScheduleVersion
  id
  projectId
  name
  description
  type              manual | baseline | imported | auto | rollback
  snapshotJson
  taskCount
  dependencyCount
  isBaseline
  createdAt
  createdById?
```

The snapshot contains normalized project schedule state:

- project metadata needed for restoration
- tasks with parent IDs, dates, status, priority, progress, and ordering identity
- dependencies with source, target, type, lag, and source metadata

The first version should snapshot only schedule-relevant data. It does not need to snapshot UI state, AI chat history, or unrelated future modules.

### User Flow

The UI exposes a version panel for the current project:

- Save current version.
- Mark one version as baseline.
- View version metadata.
- Restore a version.
- See whether the current schedule differs from the latest saved version.

Restoring a version must be guarded:

1. Save the current schedule as a `rollback` version.
2. Replace current tasks and dependencies in one transaction.
3. Recompute project date range.
4. Reload frontend state.

### Version Comparison

The first implementation may provide a simple textual summary:

- added tasks
- removed tasks
- tasks with changed planned start/end
- changed dependencies
- changed parent-child relationships

Detailed visual Gantt diff can be a later enhancement.

## AI Provider Configuration

### Model

Add an AI provider configuration model:

```text
AIProviderConfig
  id
  name
  provider          openai-compatible | anthropic
  baseUrl
  model
  apiKeyEncrypted
  apiKeyPreview
  enabled
  isDefault
  createdAt
  updatedAt
```

`openai-compatible` should support OpenAI, Orka, DeepSeek, Qwen, Tencent Hunyuan-compatible gateways, and similar providers through `baseUrl`, `apiKey`, and `model`.

### Security

API keys are sent only to the backend. The frontend never receives raw stored keys.

Backend requirements:

- Encrypt keys using `APP_SECRET` or a derived encryption key.
- Return only masked previews such as `sk-...abcd`.
- Provide a test-connection endpoint.
- Avoid logging request headers, API keys, or full provider payloads.
- Keep production `.env` and generated secrets out of Git.

If no database provider is configured, the API may fall back to environment variables for development. In production, database-backed configuration should be the preferred path.

### API

Recommended endpoints:

- `GET /ai/providers`
- `POST /ai/providers`
- `PATCH /ai/providers/:id`
- `DELETE /ai/providers/:id`
- `POST /ai/providers/:id/test`
- `POST /ai/providers/:id/default`

The existing `LLMProviderService` should be refactored so it can instantiate clients from either stored provider configs or environment variables.

## AI Features

AI should be real but controlled. It must not directly mutate the schedule without user confirmation.

### Phase 1: Real Chat

Replace the mock frontend AI sidebar with API-backed chat:

- Send current project ID, message, selected provider/model, and optional task context.
- Backend builds project context from tasks, dependencies, current date range, and critical path data.
- Response displays provider and model actually used.

### Phase 2: Insights

Generate structured insights:

- schedule risk
- dependency bottleneck
- critical path explanation
- missing dependency suggestion
- task breakdown suggestion

Insights can be saved as `AIInsight` records and linked to project/task IDs.

### Phase 3: Proposed Changes

AI may propose schedule changes, but the frontend must show a preview before applying them:

- create task
- update task dates/status/priority/progress
- create dependency
- update dependency lag/type

Apply flow:

1. AI returns structured operations.
2. Frontend renders a diff preview.
3. User confirms.
4. API saves a schedule version before applying.
5. API applies operations in a transaction.
6. Frontend reloads and shows the saved rollback version.

## Tencent Cloud Deployment

### Target

Tencent Cloud CVM running Ubuntu 22.04 or 24.04.

Recommended minimum:

- 2 CPU cores
- 4 GB RAM
- 80 GB system disk
- security group allows 80 and 443
- PostgreSQL port is not exposed publicly

### Directory Structure

Add:

```text
deploy/tencent/
  install.sh
  docker-compose.prod.yml
  Caddyfile
  env.example
  backup.sh
  restore.sh
  README.md
```

### Install Script Responsibilities

`install.sh` should:

- check OS and required commands
- install Docker and Docker Compose if missing
- clone or update the TaskPulse repository
- create production directories under `/opt/taskpulse`
- generate `.env.production` from prompts or existing values
- create Docker volumes
- start PostgreSQL
- run Prisma migrations
- build and start API/web/proxy services
- print service URLs and basic health check results

The script should be idempotent: re-running it should update and restart services without destroying data.

### Compose Services

Production compose should include:

- `postgres`
- `api`
- `web`
- `proxy`

Recommended environment values:

- `DATABASE_URL`
- `APP_SECRET`
- `TASKPULSE_CORS_ORIGIN`
- `NEXT_PUBLIC_API_URL`
- optional initial AI provider values

### Backup And Restore

`backup.sh` should use `pg_dump` and write timestamped compressed backups to `/opt/taskpulse/backups`.

`restore.sh` should:

- require explicit backup file path
- stop API while restoring
- restore into PostgreSQL
- restart API/web
- run health checks

Backups should not be committed. Optional future work can upload encrypted backups to COS.

## Testing Strategy

### Unit And Contract Tests

Add or update tests for:

- PostgreSQL-compatible Prisma mappings where applicable
- project creation, switching, duplication, archive behavior
- schedule snapshot creation and restoration
- snapshot diff summary
- AI provider masking and encryption boundaries
- provider selection fallback

### API Integration Tests

Use a PostgreSQL test database or Dockerized PostgreSQL for:

- migrations
- project duplicate transaction
- version restore transaction
- AI provider CRUD without leaking keys
- schedule rollback before AI apply

### Frontend Tests

Add tests for:

- project selector state reset
- last selected project persistence
- version panel workflows
- AI provider settings form
- AI chat replacing mock behavior
- AI proposed changes preview

### Deployment Verification

Deployment acceptance requires:

- fresh Tencent-style VM install path tested locally or on CVM
- `docker compose ps` healthy
- API health endpoint returns success
- web loads through proxy
- PostgreSQL data persists after restart
- backup and restore tested with a non-production sample database

## Risks

- Switching production to PostgreSQL while local development uses SQLite can hide database-specific issues. Mitigation: run production-like tests against PostgreSQL before deployment.
- AI provider keys are sensitive. Mitigation: encrypted storage, masked responses, no logging secrets, and `.env` hygiene.
- Version restoration can destroy current work if not guarded. Mitigation: automatic rollback snapshot before every restore or AI apply.
- Importing real schedules must not leak source files into Git. Mitigation: keep source Excel files outside the repo and retain the local privacy check.
- One-click deployment scripts can become destructive if re-run carelessly. Mitigation: idempotent scripts, explicit confirmation before destructive restore, and no automatic volume deletion.

## Acceptance Criteria

- Production deployment path uses PostgreSQL.
- Existing Whisper schedule can be migrated or re-imported into PostgreSQL without committing source data.
- Frontend can create, switch, duplicate, and archive projects.
- Current project selection persists across refresh.
- Users can save, list, baseline, and restore schedule versions.
- Version restore creates a rollback snapshot first.
- AI provider configs can be created, tested, selected, masked, and disabled from the frontend.
- AI sidebar uses the backend instead of mock-only behavior.
- AI-proposed schedule mutations require user confirmation and create a version before applying.
- Tencent deployment scripts can provision and run web, API, PostgreSQL, and proxy services.
- Backup and restore scripts are documented and verified with sample data.
