# TaskPulse Project, Version, and AI UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add usable project switching/creation, schedule version controls, AI provider configuration, and real AI chat while keeping AI schedule mutations behind a future preview-confirm-apply flow.

**Architecture:** Reuse the existing Nest/Prisma backend primitives where they already exist, add focused endpoints for Excel import and AI provider config, and keep frontend workflow state in Zustand. The first delivery prioritizes functional backend-backed UI and safe AI chat; AI Apply remains non-mutating and explicitly disabled until a diff preview/apply slice is implemented.

**Tech Stack:** pnpm/turbo, NestJS, Prisma PostgreSQL, Next.js, Zustand, `node:test`, `tsx`, OpenAI-compatible clients, Anthropic SDK.

---

## Scope For This Slice

- Project selector in the header: display metadata, switch projects, create blank project, duplicate current project, archive current project.
- Excel import: backend upload/import for the known schedule workbook shape used by the current importer.
- Schedule versions: save/list/baseline/restore through backend APIs and a compact frontend panel.
- AI provider config: backend CRUD, encrypted key storage, masked key display, default provider, test connection.
- AI chat: frontend calls real backend `/ai/chat` with current project context.
- AI Apply: no direct mutation in this slice. UI copy must make clear that schedule-changing AI suggestions are not applied automatically.

## Execution Notes

- Current workspace is still not a Git repository, so worktree/commit steps remain blocked.
- Continue using Docker PostgreSQL 17 on host port `55432`.
- Use TDD for behavior changes. Existing test commands:
  - `pnpm --filter @taskpulse/api test`
  - `pnpm --filter @taskpulse/web test`
  - `pnpm test`
  - `pnpm build`

## Task 1: Frontend API Surface

**Files:**
- Modify: `apps/web/services/api.test.ts`
- Modify: `apps/web/services/api.ts`

- [ ] Add failing tests for project create, duplicate, archive.
- [ ] Add failing tests for schedule version create/list/restore.
- [ ] Add failing tests for AI providers list/create/test/default and chat.
- [ ] Implement API client methods.
- [ ] Run `pnpm --filter @taskpulse/web test`.

## Task 2: Project Switching Store State

**Files:**
- Modify: `apps/web/store/useStore.test.ts`
- Modify: `apps/web/store/useStore.ts`

- [ ] Add failing test: `fetchData` uses persisted project id from `localStorage`.
- [ ] Add failing test: `switchProject` persists id and clears search/selected task/AI messages.
- [ ] Add failing test: blank create and duplicate select the new project and reload.
- [ ] Implement store actions and localStorage helpers guarded for SSR/tests.
- [ ] Run `pnpm --filter @taskpulse/web test`.

## Task 3: Project Selector UI

**Files:**
- Create: `apps/web/components/ProjectSelector.tsx`
- Modify: `apps/web/components/Layout.tsx`

- [ ] Build compact header selector showing name, status, start/end.
- [ ] Add dropdown list with switch, blank project create, duplicate, archive.
- [ ] Add file input for Excel import wired to API upload.
- [ ] Keep UI dense and operational, not a landing-style panel.
- [ ] Run `pnpm --filter @taskpulse/web test`.

## Task 4: Schedule Version UI

**Files:**
- Create: `apps/web/components/ScheduleVersionPanel.tsx`
- Modify: `apps/web/components/Layout.tsx` or `apps/web/app/page.tsx`

- [ ] Add compact version panel reachable from header.
- [ ] Support save current version, save baseline, list versions, restore with confirmation.
- [ ] On restore, reload project tasks and clear project-scoped UI state.
- [ ] Run `pnpm --filter @taskpulse/web test`.

## Task 5: Excel Import Backend

**Files:**
- Modify: `apps/api/scripts/import-whisper-schedule.ts`
- Modify: `apps/api/src/projects/projects.controller.ts`
- Modify: `apps/api/src/projects/projects.service.ts`
- Add tests if practical: `apps/api/src/projects/projects.service.spec.ts`

- [ ] Export reusable parser/dependency helpers from importer.
- [ ] Add upload endpoint that accepts an Excel file and imports to a new project.
- [ ] Avoid SQLite-specific raw SQL in the backend import path.
- [ ] Use Prisma create/delete APIs and PostgreSQL-compatible transactions.
- [ ] Run `pnpm --filter @taskpulse/api test`.

## Task 6: AI Provider Backend

**Files:**
- Create: `apps/api/src/ai/dto/ai-provider-config.dto.ts`
- Modify: `apps/api/src/ai/llm.provider.ts`
- Modify: `apps/api/src/ai/ai.controller.ts`
- Modify: `apps/api/src/ai/ai.service.ts`
- Add tests: `apps/api/src/ai/llm.provider.test.ts` or service-level tests

- [ ] Add encryption helpers using `APP_SECRET`.
- [ ] Store encrypted keys and masked previews only.
- [ ] Add CRUD/default/test endpoints under `/ai/providers`.
- [ ] Let chat use default DB provider first, with env fallback.
- [ ] Run `pnpm --filter @taskpulse/api test`.

## Task 7: Real AI Sidebar

**Files:**
- Modify: `apps/web/components/AISidebar.tsx`
- Modify: `apps/web/services/api.ts`
- Modify: `apps/web/store/useStore.ts`

- [ ] Replace mock timeout with `api.chat`.
- [ ] Reset AI messages when project changes.
- [ ] Show provider/model returned by backend.
- [ ] Remove direct AI task creation from chat.
- [ ] Add explicit non-mutating Apply notice for now.
- [ ] Run `pnpm --filter @taskpulse/web test`.

## Task 8: Final Verification

- [ ] Run `pnpm --filter @taskpulse/api test`.
- [ ] Run `pnpm --filter @taskpulse/web test`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Verify API/Web still run against Docker PostgreSQL 17 on `localhost:55432`.
