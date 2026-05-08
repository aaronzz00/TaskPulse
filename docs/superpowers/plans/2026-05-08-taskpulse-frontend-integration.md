# TaskPulse Frontend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the new Next.js TaskPulse frontend with the existing NestJS backend in a clean monorepo and verify the full system.

**Architecture:** Keep the GitHub repository as the final Git source of truth. Move the current backend into `apps/api`, move the new frontend into `apps/web`, and introduce `packages/contracts` for shared DTOs plus frontend mapping helpers. The frontend talks to the backend through a narrow API client and keeps UI date strings separate from backend ISO dates.

**Tech Stack:** pnpm, Turborepo, Next.js 15, React 19, Tailwind CSS 4, Zustand, NestJS 10, Prisma 5, SQLite for local development, Vitest or Node test runner where practical.

---

### Task 1: Establish Monorepo Structure

**Files:**
- Modify: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Move: root Next frontend files into `apps/web/`
- Copy: local backend source into `apps/api/`
- Copy: local shared source into `packages/contracts/`
- Create: `assets/icons/`

- [ ] Move current root frontend files (`app`, `components`, `hooks`, `lib`, `services`, `store`, `types`, Next configs) into `apps/web/`.
- [ ] Copy local `apps/api` from `/Users/zz-orka/zOS/10_PROJECTS/PJ-2026-06_TaskPulse/apps/api` to `apps/api`.
- [ ] Convert `packages/shared` into `packages/contracts`.
- [ ] Update root `package.json` to use pnpm/turbo workspace scripts.
- [ ] Add `pnpm-workspace.yaml` including `apps/*` and `packages/*`.
- [ ] Add `turbo.json` with build/test/dev tasks.
- [ ] Run `pnpm install`.
- [ ] Run `pnpm build` and record any baseline errors before fixing.
- [ ] Commit with `chore: restructure taskpulse monorepo`.

### Task 2: Shared Contracts and Mapping Tests

**Files:**
- Create/Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/mappers.ts`
- Create: `packages/contracts/src/mappers.test.ts`
- Modify: `packages/contracts/package.json`
- Modify: `packages/contracts/tsconfig.json`

- [ ] Write failing mapper tests for backend task + dependency rows converting to UI tasks with `YYYY-MM-DD` dates and UI dependency shape.
- [ ] Run the mapper test and verify it fails because implementation is missing.
- [ ] Implement contract types and mapping helpers.
- [ ] Run the mapper test and verify it passes.
- [ ] Commit with `feat(contracts): add taskpulse data mappers`.

### Task 3: Backend Batch Update Endpoint

**Files:**
- Create: `apps/api/src/tasks/dto/batch-update-task.dto.ts`
- Modify: `apps/api/src/tasks/tasks.controller.ts`
- Modify: `apps/api/src/tasks/tasks.service.ts`
- Create/Modify: `apps/api/src/tasks/tasks.service.spec.ts`

- [ ] Write a failing backend test for `TasksService.batchUpdate` applying two task updates in one transaction.
- [ ] Run the backend test and verify it fails because `batchUpdate` is missing.
- [ ] Add `BatchUpdateTaskDto`.
- [ ] Implement `TasksService.batchUpdate`.
- [ ] Add `PATCH /tasks/batch` controller route before `PATCH /tasks/:id`.
- [ ] Run the backend test and verify it passes.
- [ ] Commit with `feat(api): add batch task updates`.

### Task 4: Frontend API Client and Store Integration

**Files:**
- Modify: `apps/web/services/api.ts`
- Modify: `apps/web/store/useStore.ts`
- Modify: `apps/web/types/index.ts`
- Modify: `apps/web/tsconfig.json`
- Modify: `apps/web/next.config.ts`

- [ ] Write failing frontend/store tests for loading backend projects/tasks and rolling back a failed update where feasible.
- [ ] Run the test and verify it fails because the API client still uses mocks.
- [ ] Replace mock API calls with `fetch` calls using `NEXT_PUBLIC_API_URL`.
- [ ] Use `@taskpulse/contracts` mapping helpers for API responses.
- [ ] Update store `fetchData`, `createTask`, `updateTask`, `deleteTask`, and cascaded schedule sync.
- [ ] Route cascaded schedule changes through `api.batchUpdateTasks`.
- [ ] Run frontend/store tests and verify they pass.
- [ ] Commit with `feat(web): connect workspace to backend api`.

### Task 5: Icons and Metadata

**Files:**
- Copy: local `icons/` to `assets/icons/`
- Copy: runtime icon files to `apps/web/public/icons/`
- Modify: `apps/web/app/layout.tsx`
- Create/Modify: `apps/web/app/manifest.ts`

- [ ] Copy the provided icon assets into source and web-public locations.
- [ ] Replace generic metadata with TaskPulse title and description.
- [ ] Wire favicon, Apple touch icon, and manifest icons to provided assets.
- [ ] Run frontend build to verify metadata paths compile.
- [ ] Commit with `feat(web): apply taskpulse icons`.

### Task 6: System Verification

**Files:**
- Create: `docs/testing/system-test-plan.md`
- Modify: `README.md`

- [ ] Document the system test plan: install, Prisma generate, migrate/seed, backend API smoke tests, frontend build, and browser smoke test.
- [ ] Run `pnpm install`.
- [ ] Run `pnpm --filter @taskpulse/contracts test`.
- [ ] Run `pnpm --filter @taskpulse/api build`.
- [ ] Run `pnpm --filter @taskpulse/web build`.
- [ ] Start backend and frontend locally.
- [ ] Smoke test `GET /projects` and `GET /tasks?projectId=...`.
- [ ] Open the frontend and verify the workspace renders seeded tasks and icons.
- [ ] Commit with `docs: add system test plan`.
- [ ] Push branch/main to GitHub.
