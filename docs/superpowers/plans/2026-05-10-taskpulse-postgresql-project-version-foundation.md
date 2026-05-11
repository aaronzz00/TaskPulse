# TaskPulse PostgreSQL Project Version Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the production PostgreSQL foundation and add the backend project lifecycle and schedule versioning primitives needed by the next frontend and AI work.

**Architecture:** Switch the production Prisma contract to PostgreSQL, add focused Nest modules/services for project duplication and schedule snapshots, and keep deployment assets under `deploy/tencent`. Use service-level `node:test` tests with mocked Prisma first, then run Prisma generation/build to catch schema and type errors.

**Tech Stack:** pnpm/turbo, NestJS, Prisma PostgreSQL, `node:test`, `tsx`, Docker Compose, Caddy.

---

## Execution Status

Updated May 10, 2026:

- Completed PostgreSQL schema baseline and Prisma client validation.
- Completed project archive and duplicate API work with tests.
- Completed schedule version snapshot/restore API work with tests.
- Completed local PostgreSQL 17 Docker setup on host port `55432`.
- Completed Tencent compose update to `postgres:17`.
- Completed agent bootstrap files: `AGENTS.md` and `.agent/README.md`.
- Verified `pnpm test`, `pnpm build`, Prisma connection to Docker PostgreSQL, API smoke, Web smoke, and local data privacy check.
- Remaining blocker: this workspace is not currently a Git repository, so worktree, commit, and push steps cannot be performed here.
- Remaining product work for later slices: frontend project switcher/version UI, AI provider settings UI/API, AI mutation preview/apply workflow, and full Tencent CVM install script hardening.

## Current Context

- Workspace root: `/Users/zz-orka/zOS/10_PROJECTS/PJ-2026-06_TaskPulse`
- The workspace is currently not a Git repository, so commit steps are documented but cannot run until Git is initialized or the project is placed back under Git.
- Existing design spec: `docs/superpowers/specs/2026-05-09-taskpulse-productization-postgresql-ai-deployment-design.md`
- Current Prisma datasource: SQLite in `apps/api/prisma/schema.prisma`.
- Current local database: `apps/api/prisma/dev.db`, containing local Whisper data. Do not commit this file or derived private schedule data.
- Existing API modules: projects, tasks, dependencies, insights, AI, websocket.
- Existing test command: `pnpm --filter @taskpulse/api test`
- Existing build command: `pnpm build`

## Scope

This plan intentionally covers the first backend/deployment slice only:

- PostgreSQL Prisma schema baseline.
- `ScheduleVersion` model and service.
- Project archive and duplicate backend endpoints.
- Local production-like PostgreSQL compose file for verification.
- Tencent deployment skeleton.

It does not implement the frontend project switcher, AI provider settings UI, AI mutation preview UI, or real Tencent CVM installation in this slice.

## File Structure

- Modify: `apps/api/prisma/schema.prisma`
  - Change datasource to PostgreSQL.
  - Add `ScheduleVersion`.
  - Add `AIProviderConfig` only as schema groundwork, without wiring UI/API yet.
  - Add indexes and relations needed by project lifecycle and version restore.
- Create: `apps/api/src/projects/projects.service.spec.ts`
  - Service tests for archive and duplicate behavior.
- Modify: `apps/api/src/projects/projects.service.ts`
  - Add `archive(id)` and `duplicate(id, options?)`.
- Modify: `apps/api/src/projects/projects.controller.ts`
  - Add `POST /projects/:id/archive` and `POST /projects/:id/duplicate`.
- Create: `apps/api/src/projects/dto/duplicate-project.dto.ts`
  - Optional duplicate name and baseline-copy control.
- Create: `apps/api/src/schedule-versions/schedule-versions.module.ts`
- Create: `apps/api/src/schedule-versions/schedule-versions.service.ts`
- Create: `apps/api/src/schedule-versions/schedule-versions.service.spec.ts`
- Create: `apps/api/src/schedule-versions/schedule-versions.controller.ts`
- Create: `apps/api/src/schedule-versions/dto/create-schedule-version.dto.ts`
- Create: `apps/api/src/schedule-versions/dto/restore-schedule-version.dto.ts`
- Modify: `apps/api/src/app.module.ts`
  - Register `ScheduleVersionsModule`.
- Create: `deploy/tencent/docker-compose.prod.yml`
- Create: `deploy/tencent/Caddyfile`
- Create: `deploy/tencent/env.example`
- Create: `deploy/tencent/README.md`
- Create: `docs/deployment/postgresql.md`

## Task 1: PostgreSQL Prisma Baseline

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create or update docs only if needed: `docs/deployment/postgresql.md`

- [ ] **Step 1: Write down expected schema behavior**

Add `docs/deployment/postgresql.md` with:

```md
# PostgreSQL Deployment Notes

TaskPulse production uses PostgreSQL through Prisma.

Required environment:

```env
DATABASE_URL=postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public
APP_SECRET=replace-with-32-byte-secret
```

Local SQLite data in `apps/api/prisma/dev.db` is development/private data and is not the production contract.
```

- [ ] **Step 2: Update Prisma schema**

Change:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Add to `Project`:

```prisma
  scheduleVersions ScheduleVersion[]
```

Add model:

```prisma
model ScheduleVersion {
  id              String   @id @default(cuid())
  projectId       String
  name            String
  description     String   @default("")
  type            String   @default("manual")
  snapshotJson    Json
  taskCount       Int      @default(0)
  dependencyCount Int      @default(0)
  isBaseline      Boolean  @default(false)
  createdAt       DateTime @default(now())
  createdById     String?

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt])
  @@index([projectId, isBaseline])
}
```

Add model:

```prisma
model AIProviderConfig {
  id              String   @id @default(cuid())
  name            String
  provider        String
  baseUrl         String?
  model           String
  apiKeyEncrypted String
  apiKeyPreview   String
  enabled         Boolean  @default(true)
  isDefault       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([enabled, isDefault])
}
```

- [ ] **Step 3: Run Prisma generation**

Run:

```bash
DATABASE_URL="postgresql://taskpulse:taskpulse@localhost:55432/taskpulse?schema=public" pnpm --filter @taskpulse/api prisma:generate
```

Expected: Prisma client generation succeeds without connecting to the database.

## Task 2: Project Archive And Duplicate

**Files:**
- Create: `apps/api/src/projects/projects.service.spec.ts`
- Create: `apps/api/src/projects/dto/duplicate-project.dto.ts`
- Modify: `apps/api/src/projects/projects.service.ts`
- Modify: `apps/api/src/projects/projects.controller.ts`

- [ ] **Step 1: Write failing archive test**

Create `projects.service.spec.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { ProjectsService } from './projects.service';

test('archive marks the project archived without deleting data', async () => {
  const updates: unknown[] = [];
  const prisma = {
    project: {
      update: async (args: unknown) => {
        updates.push(args);
        return { id: 'project-1', status: 'archived' };
      },
    },
  };
  const service = new ProjectsService(prisma as any);

  const result = await service.archive('project-1');

  assert.equal(result.status, 'archived');
  assert.deepEqual(updates, [
    { where: { id: 'project-1' }, data: { status: 'archived' } },
  ]);
});
```

Run:

```bash
pnpm --filter @taskpulse/api test
```

Expected: FAIL because `archive` does not exist.

- [ ] **Step 2: Implement archive**

Add to `ProjectsService`:

```ts
async archive(id: string) {
  return this.prisma.project.update({
    where: { id },
    data: { status: 'archived' },
  });
}
```

Add to `ProjectsController`:

```ts
@Post(':id/archive')
archive(@Param('id') id: string) {
  return this.projectsService.archive(id);
}
```

- [ ] **Step 3: Run archive test green**

Run:

```bash
pnpm --filter @taskpulse/api test
```

Expected: archive test passes.

- [ ] **Step 4: Write failing duplicate test**

Append a test that sets up a source project with two tasks and one dependency, then asserts `duplicate`:

```ts
test('duplicate copies project tasks and dependencies in a transaction', async () => {
  const calls: string[] = [];
  const prisma = {
    $transaction: async (fn: any) => fn(prisma),
    project: {
      findUnique: async () => ({
        id: 'source-project',
        name: 'Source',
        description: 'Original',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-01-31T00:00:00.000Z'),
        status: 'active',
        tasks: [
          {
            id: 'task-a',
            parentId: null,
            title: 'A',
            description: '',
            status: 'todo',
            assigneeId: null,
            plannedStart: new Date('2026-01-01T00:00:00.000Z'),
            plannedEnd: new Date('2026-01-02T00:00:00.000Z'),
            actualStart: null,
            actualEnd: null,
            estimatedHours: 0,
            actualHours: 0,
            priority: 'medium',
            progress: 0,
            aiConfidence: null,
            aiReasoning: null,
          },
          {
            id: 'task-b',
            parentId: 'task-a',
            title: 'B',
            description: '',
            status: 'todo',
            assigneeId: null,
            plannedStart: new Date('2026-01-03T00:00:00.000Z'),
            plannedEnd: new Date('2026-01-04T00:00:00.000Z'),
            actualStart: null,
            actualEnd: null,
            estimatedHours: 0,
            actualHours: 0,
            priority: 'medium',
            progress: 0,
            aiConfidence: null,
            aiReasoning: null,
          },
        ],
        dependencies: [{ sourceTaskId: 'task-a', targetTaskId: 'task-b', type: 'FS', lag: 0, source: 'manual' }],
      }),
      create: async () => {
        calls.push('project.create');
        return { id: 'copy-project' };
      },
    },
    task: {
      create: async () => {
        calls.push('task.create');
        return { id: `copy-task-${calls.filter((call) => call === 'task.create').length}` };
      },
    },
    dependency: {
      create: async () => {
        calls.push('dependency.create');
        return {};
      },
    },
  };
  const service = new ProjectsService(prisma as any);

  await service.duplicate('source-project', { name: 'Copy' });

  assert.deepEqual(calls, ['project.create', 'task.create', 'task.create', 'dependency.create']);
});
```

Run:

```bash
pnpm --filter @taskpulse/api test
```

Expected: FAIL because `duplicate` does not exist.

- [ ] **Step 5: Implement duplicate**

Add DTO:

```ts
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class DuplicateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  copyBaseline?: boolean;
}
```

In `ProjectsService.duplicate`:

- Load the source project with tasks and dependencies.
- Create a new project in a transaction.
- Create copied tasks in source order.
- Maintain an `oldTaskId -> newTaskId` map.
- Use the map to preserve copied `parentId`.
- Copy dependencies only when both endpoints were copied.
- Return `findOne(newProject.id)`.

In `ProjectsController`:

```ts
@Post(':id/duplicate')
duplicate(@Param('id') id: string, @Body() dto: DuplicateProjectDto) {
  return this.projectsService.duplicate(id, dto);
}
```

- [ ] **Step 6: Run project tests green**

Run:

```bash
pnpm --filter @taskpulse/api test
```

Expected: all API tests pass.

## Task 3: Schedule Version Service

**Files:**
- Create: `apps/api/src/schedule-versions/schedule-versions.service.spec.ts`
- Create: `apps/api/src/schedule-versions/schedule-versions.service.ts`
- Create: `apps/api/src/schedule-versions/dto/create-schedule-version.dto.ts`
- Create: `apps/api/src/schedule-versions/dto/restore-schedule-version.dto.ts`

- [ ] **Step 1: Write failing snapshot test**

Create a test proving `createSnapshot(projectId, dto)`:

- Loads project tasks with dependents.
- Saves `snapshotJson` with project, tasks, and dependencies.
- Stores `taskCount` and `dependencyCount`.
- Clears prior baseline flags when `isBaseline` is true.

Run:

```bash
pnpm --filter @taskpulse/api test
```

Expected: FAIL because the service does not exist.

- [ ] **Step 2: Implement createSnapshot**

Create DTO:

```ts
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateScheduleVersionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['manual', 'baseline', 'imported', 'auto', 'rollback'])
  type?: string;

  @IsOptional()
  @IsBoolean()
  isBaseline?: boolean;
}
```

Implement `ScheduleVersionsService.createSnapshot(projectId, dto)` with a Prisma transaction:

- Verify project exists.
- Collect unique dependencies from task `dependents`.
- If baseline, update existing versions for project to `isBaseline: false`.
- Create `scheduleVersion`.

- [ ] **Step 3: Run snapshot test green**

Run:

```bash
pnpm --filter @taskpulse/api test
```

Expected: snapshot test passes.

- [ ] **Step 4: Write failing restore test**

Create a test proving `restore(projectId, versionId)`:

- Creates a rollback snapshot first.
- Deletes current dependencies and tasks for the project.
- Recreates tasks from the snapshot.
- Recreates dependencies from the snapshot.
- Updates project metadata and date range.
- Runs all mutations in one transaction.

Run:

```bash
pnpm --filter @taskpulse/api test
```

Expected: FAIL because `restore` is not implemented.

- [ ] **Step 5: Implement restore**

Create DTO placeholder for future options:

```ts
export class RestoreScheduleVersionDto {}
```

Implement restore with these safeguards:

- Load the version and ensure it belongs to `projectId`.
- Call the same snapshot builder to save a `rollback` version before destructive changes.
- Delete dependencies whose source or target task belongs to the project before deleting tasks.
- Recreate tasks before dependencies.
- Preserve original task IDs when restoring, so dependency endpoints remain valid.
- Update project `startDate` and `endDate` from snapshot project metadata when present.

- [ ] **Step 6: Run restore test green**

Run:

```bash
pnpm --filter @taskpulse/api test
```

Expected: all schedule version tests pass.

## Task 4: Schedule Version API Module

**Files:**
- Create: `apps/api/src/schedule-versions/schedule-versions.module.ts`
- Create: `apps/api/src/schedule-versions/schedule-versions.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Add controller methods**

Expose:

```ts
POST /projects/:projectId/schedule-versions
GET /projects/:projectId/schedule-versions
POST /projects/:projectId/schedule-versions/:versionId/restore
```

- [ ] **Step 2: Register module**

Import `ScheduleVersionsModule` in `AppModule`.

- [ ] **Step 3: Run API test/build**

Run:

```bash
pnpm --filter @taskpulse/api test
pnpm --filter @taskpulse/api build
```

Expected: tests and build pass.

## Task 5: Production Compose Skeleton

**Files:**
- Create: `deploy/tencent/docker-compose.prod.yml`
- Create: `deploy/tencent/Caddyfile`
- Create: `deploy/tencent/env.example`
- Create: `deploy/tencent/README.md`

- [ ] **Step 1: Add env example**

Create `deploy/tencent/env.example`:

```env
POSTGRES_DB=taskpulse
POSTGRES_USER=taskpulse
POSTGRES_PASSWORD=change-me
DATABASE_URL=postgresql://taskpulse:change-me@postgres:5432/taskpulse?schema=public
APP_SECRET=replace-with-32-byte-secret
TASKPULSE_CORS_ORIGIN=https://taskpulse.example.com
NEXT_PUBLIC_API_URL=https://taskpulse.example.com/api
```

- [ ] **Step 2: Add Docker Compose**

Compose must include `postgres`, `api`, `web`, and `proxy`, with PostgreSQL exposed only to the compose network.

- [ ] **Step 3: Add Caddyfile**

Proxy `/api/*` to API and all other routes to Web.

- [ ] **Step 4: Add README**

Document:

- required CVM ports 80/443
- copying `env.example` to `.env`
- starting services
- running migrations
- backing up PostgreSQL with `pg_dump`

- [ ] **Step 5: Run static verification**

Run:

```bash
pnpm --filter @taskpulse/api build
pnpm --filter @taskpulse/web build
```

Expected: both builds pass. If builds require a live PostgreSQL connection, start a local PostgreSQL container or document the blocker.

## Task 6: Final Verification

**Files:**
- Update as needed: `docs/testing/system-test-plan.md`

- [ ] Run API tests:

```bash
pnpm --filter @taskpulse/api test
```

- [ ] Run full tests:

```bash
pnpm test
```

- [ ] Run build:

```bash
pnpm build
```

- [ ] Verify generated files do not include private data:

```bash
find . -path './node_modules' -prune -o -path './apps/web/.next' -prune -o -type f -print | rg 'Whisper_Schedule|dev.db|local-backups'
```

Expected: no committed source/config file references private schedule source files as deploy inputs.

- [ ] If Git becomes available, verify:

```bash
git status --short
git diff --name-only
```

Expected: only source, docs, and deployment template files are changed. No `.env`, `.db`, `.xlsx`, `.local-backups`, or generated build output is tracked.

## Execution Notes

- Do not run destructive database commands against `apps/api/prisma/dev.db`.
- Do not commit or print raw API keys, `.env` contents, database passwords, or real project schedule source files.
- PostgreSQL migration files can be generated after a local PostgreSQL instance is available. Until then, schema generation and TypeScript build are the minimum verification.
- The plan review subagent step from the writing-plans workflow was not run here because this session has no explicit user authorization to spawn subagents.
