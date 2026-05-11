# TaskPulse Gantt Usability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add search, bounded timeline navigation, better dependency selection, dependency display modes, and critical path highlighting.

**Architecture:** Keep behavior in small frontend helpers under `apps/web/lib`, then wire them into `Layout`, `Workspace`, `TaskDrawer`, and the zustand store. Reuse existing task data from `/tasks`; compute critical path client-side from planned dates and dependencies to keep the feature responsive.

**Tech Stack:** Next.js/React, zustand, canvas drawing, node:test/tsx, TypeScript.

---

### Task 1: Search Model And Header Search

**Files:**
- Create: `apps/web/lib/taskDisplay.ts`
- Create: `apps/web/lib/taskSearch.ts`
- Test: `apps/web/lib/taskDisplay.test.ts`
- Test: `apps/web/lib/taskSearch.test.ts`
- Modify: `apps/web/store/useStore.ts`
- Modify: `apps/web/components/Layout.tsx`
- Modify: `apps/web/components/Workspace.tsx`

- [ ] Write failing tests for stable display IDs and search matching.
- [ ] Add store state for `searchQuery`, `activeSearchResultIndex`, and actions.
- [ ] Make the header input controlled and focusable with `Cmd+K`.
- [ ] Highlight matching rows and auto-expand ancestors of matches.
- [ ] Enter advances through results and scrolls the selected match into view.
- [ ] Run `pnpm --filter @taskpulse/web test`.

### Task 2: Timeline Bounds And Today Navigation

**Files:**
- Modify: `apps/web/lib/timeline.ts`
- Test: `apps/web/lib/timeline.test.ts`
- Modify: `apps/web/components/Workspace.tsx`

- [ ] Write failing tests for `getTimelineBounds`, `clampTimelineScrollX`, and `getTodayScrollX`.
- [ ] Clamp horizontal wheel/pan scroll to project bounds plus buffer.
- [ ] Add a `Today` button beside day/week/month controls.
- [ ] Draw a Today line and label when today is inside or near the project range.
- [ ] Run `pnpm --filter @taskpulse/web test`.

### Task 3: Dependency Picker And Task IDs

**Files:**
- Create: `apps/web/lib/dependencyDisplay.ts`
- Test: `apps/web/lib/dependencyDisplay.test.ts`
- Modify: `apps/web/components/TaskDrawer.tsx`
- Modify: `apps/web/components/Workspace.tsx`

- [ ] Write failing tests for dependency candidate filtering and labels.
- [ ] Replace all-task checkbox list with current dependency cards plus a searchable Add Dependency picker.
- [ ] Display compact task IDs in the task list and drawer.
- [ ] Search dependency candidates by ID, title, status, and dates.
- [ ] Run `pnpm --filter @taskpulse/web test`.

### Task 4: Dependency Line Modes And Critical Path

**Files:**
- Create: `apps/web/lib/criticalPath.ts`
- Test: `apps/web/lib/criticalPath.test.ts`
- Modify: `apps/web/store/useStore.ts`
- Modify: `apps/web/components/Workspace.tsx`

- [ ] Write failing tests for client-side critical path calculation.
- [ ] Add `dependencyViewMode`: `selected`, `critical`, `all`, `off`.
- [ ] Add a Critical Path toggle and dependency line mode control.
- [ ] Draw selected/critical/all dependency lines with different opacity and critical highlighting.
- [ ] Highlight critical task bars and task rows.
- [ ] Run `pnpm --filter @taskpulse/web test`.

### Task 5: Full Verification And Manual Test Startup

**Files:**
- No new production files.

- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Run local data privacy and Whisper count checks.
- [ ] Restart API and web dev servers.
- [ ] Smoke test `/projects`, `/tasks?projectId=whisper-20260508`, and `http://localhost:5173`.
