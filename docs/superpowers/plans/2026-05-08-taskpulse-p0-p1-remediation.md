# TaskPulse P0/P1 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the P0/P1 issues found after importing the real Whisper project schedule: restore date fidelity, persist dependency and hierarchy edits, make the timeline data-driven, and remove save/feedback UX traps.

**Architecture:** Keep the current pnpm monorepo shape. Put reusable schedule import/parsing logic in API-side scripts/utilities, keep backend persistence behind existing Nest services, and keep frontend state changes inside the API client plus Zustand store. Do not commit Whisper schedule data or generated local database contents.

**Tech Stack:** pnpm/turbo, NestJS, Prisma SQLite, Next.js, Zustand, `node:test`, `tsx`, `@taskpulse/contracts`.

---

## Current Context

- Workspace root: `/Users/zz-orka/zOS/10_PROJECTS/PJ-2026-06_TaskPulse`
- Local API: `http://localhost:3001`
- Local web: `http://localhost:5173`
- Local DB: `apps/api/prisma/dev.db`
- Whisper Excel source, local only: `/Users/zz-orka/zOS/20_WIKI/2026_Frame/Whisper_Schedule_20260508.xlsx`
- Excel sheet: `Whisper_WIP`
- Existing imported state before remediation: 102 tasks, 95 dependencies, 89 child tasks, 13 root tasks.
- Verified before remediation:
  - Parent/child links match Excel indent exactly: 89/89.
  - Dependencies match Excel `Predecessors` exactly: 95/95.
  - Dates do not match: 56 task date mismatches.
  - DB DateTime storage is mixed: 57 integer rows and 45 text rows for both `plannedStart` and `plannedEnd`.
- Data privacy rule: do not upload or commit the Whisper Excel file, `apps/api/prisma/dev.db`, `.local-backups/*`, or derived project data.
- Execution order rule: Task 1 may be implemented independently. Tasks 2, 3, and 4 must be executed serially because they share `apps/web/store/useStore.ts` and `apps/web/components/TaskDrawer.tsx`.

## Root Cause Notes

- Date mismatch is not a UI-only formatting issue. API returns shifted dates because many imported DB rows store integer millisecond values rather than consistent Prisma DateTime strings. The fix must normalize local data and add a repeatable import/check path.
- Date-only fidelity rule: Excel date cells represent project-local calendar dates. Import them as UTC midnight RFC3339 (`YYYY-MM-DDT00:00:00.000Z`) generated from the year/month/day fields, not by converting local timezone instants.
- Dependency UI edits mutate `task.dependencies`, but `apps/web/services/api.ts` intentionally strips `dependencies` from task PATCH payloads. The frontend must call the backend dependency endpoints.
- Hierarchy drag uses `moveTask` in `apps/web/store/useStore.ts`, but this only changes local state. It must persist `parentId`.
- Timeline calculations in `apps/web/components/Workspace.tsx` are hardcoded to `2026-05-01` and use `Math.abs` in one date calculation, which hides tasks before May in the wrong direction.

---

## Task 1: Local Whisper Import and Date Normalization

**Files:**
- Create: `apps/api/scripts/import-whisper-schedule.ts`
- Create: `apps/api/scripts/import-whisper-schedule.test.ts`
- Modify: `apps/api/package.json`
- Modify local only: `apps/api/prisma/dev.db`

**Requirements:**
- Parse `.xlsx` from a CLI path argument.
- Default sheet: `Whisper_WIP`.
- Preserve task row order using IDs `whisper-001` through `whisper-102`.
- Preserve hierarchy from Excel cell `alignment.indent`.
- Preserve dependencies from `Predecessors`, supporting comma-separated entries, relation types `FS`, `SS`, `FF`, `SF`, and lag units `d` and `w`.
- Fill missing dates using the already approved rule: missing start/end -> previous task end + 1 day; end same day.
- Write DateTime values through Prisma or as RFC3339 strings accepted by Prisma. Do not write raw integer milliseconds.
- Replace existing `whisper-20260508` project data in local DB; do not touch other projects.
- Write an import report to `.local-backups/whisper-import-report.json`.
- In the import report, distinguish:
  - `missingDateFixes`: the two approved blank-date repairs.
  - `dateMismatchesAfterImport`: must be `0`.
  - `hierarchyMismatchesAfterImport`: must be `0`.
  - `dependencyMismatchesAfterImport`: must be `0`.
  - `dateStorageTypes`: should show text/RFC3339-compatible storage for all imported task dates when inspected via SQLite.

- [ ] **Step 1: Write failing parser tests**
  - Test predecessor parsing for `93, 97`, `87SS +1w`, `99SS +5d`, and default `FS`.
  - Test hierarchy parent assignment from indent sequence.
  - Test missing-date fill rule.
  - Test date-only conversion from Excel-like `Date` objects preserves calendar day across early, middle, and late project dates, including `2026-02-24`, `2026-07-01`, and `2027-04-14`.
  - Run: `pnpm --filter @taskpulse/api test`
  - Expected: new tests fail because importer helpers do not exist.

- [ ] **Step 2: Implement importer helpers and CLI**
  - Export pure helpers from the script so tests can import them.
  - Keep CLI execution guarded so tests do not mutate DB.
  - Add package script `import:whisper`.

- [ ] **Step 3: Run tests green**
  - Run: `pnpm --filter @taskpulse/api test`
  - Expected: parser/importer helper tests pass with existing API tests.

- [ ] **Step 4: Run local import against Whisper Excel**
  - Run: `DATABASE_URL="file:./dev.db" pnpm --filter @taskpulse/api import:whisper -- /Users/zz-orka/zOS/20_WIKI/2026_Frame/Whisper_Schedule_20260508.xlsx`
  - Expected: report shows 102 tasks, 95 dependencies, 89 parent links, 2 missing-date fixes, and 0 post-import date/hierarchy/dependency mismatches.

- [ ] **Step 5: Verify DB and API against Excel**
  - Verify SQLite DateTime storage for imported task planned dates is no longer mixed.
  - Verify API returns 102 tasks.
  - Verify Excel vs API has 0 date mismatches, 0 dependency mismatches, 0 hierarchy mismatches.

---

## Task 2: Persist Dependency Editing

**Files:**
- Modify: `apps/web/services/api.ts`
- Modify: `apps/web/services/api.test.ts`
- Modify: `apps/web/store/useStore.ts`
- Modify: `apps/web/components/TaskDrawer.tsx`

**Requirements:**
- Add frontend API methods for dependency create, update, delete, and find by task if useful.
- Dependency checkbox on means create `sourceTaskId = selected predecessor`, `targetTaskId = current task`.
- Dependency checkbox off means delete the existing dependency.
- Type/lag edits must update the existing dependency, not attempt a task PATCH.
- Frontend workspace dependency shape currently lacks backend dependency ID. Extend the contracts or frontend type shape as needed so updates/deletes can target the dependency row.
- Avoid creating duplicate dependencies.
- Keep the existing task auto-schedule behavior after dependency changes; if dependency changes alter successor constraints, recalculate/persist affected task dates.
- Surface errors through store `error` and rollback optimistic changes.
- Verify dependency create/update/delete survives `fetchData()` or browser refresh and is reflected by backend dependency rows.

- [ ] **Step 1: Write failing API client tests**
  - Create dependency should call `POST /dependencies`.
  - Update dependency should call `PATCH /dependencies/:id`.
  - Delete dependency should call `DELETE /dependencies/:id`.
  - Run: `pnpm --filter @taskpulse/web test`
  - Expected: tests fail because methods do not exist.

- [ ] **Step 2: Implement API client and type mapping**
  - Preserve existing task update behavior.
  - Include dependency ID in mapped workspace dependency.

- [ ] **Step 3: Update store actions**
  - Add `createDependency`, `updateDependency`, `deleteDependency` actions or a single dependency mutation action.
  - Roll back state on API failure.

- [ ] **Step 4: Wire TaskDrawer**
  - Replace `updateTask(... { dependencies })` calls with dependency actions.
  - Keep type/lag controls disabled or hidden until the dependency row has an ID.

- [ ] **Step 5: Run tests**
  - Run: `pnpm --filter @taskpulse/web test`
  - Expected: all web tests pass.

- [ ] **Step 6: Verify persistence**
  - Use API or browser smoke to create/update/delete one dependency.
  - Refresh data.
  - Expected: the dependency row and UI state match the latest backend state.

---

## Task 3: Persist Hierarchy Drag and Fix Timeline Date Math

**Files:**
- Modify: `apps/web/store/useStore.ts`
- Modify: `apps/web/components/Workspace.tsx`
- Add or modify tests where practical under `apps/web`

**Requirements:**
- Change `moveTask` to async and persist the dragged task `parentId` through `api.updateTask`.
- Roll back the previous task order and parent on failure.
- Keep cycle prevention in `Workspace.tsx` `canDrop`.
- Compute `timelineStartDate` from the minimum planned start across tasks, with a small margin, not a hardcoded date.
- Remove `Math.abs` from date-to-x calculations so dates before the timeline origin are not mirrored.
- New task default dates should come from the current project/task context rather than hardcoded `2026-05-15`.
- Verify hierarchy drag survives `fetchData()` or browser refresh and the backend `parentId` row matches the UI.

- [ ] **Step 1: Write failing tests for timeline helpers**
  - Extract `getTimelineStartDate` and `getXFromDate` into a small testable helper if needed.
  - Test that a February task in Whisper appears after the computed start, and that dates before start produce negative X rather than mirrored positive X.

- [ ] **Step 2: Implement helper and wire Workspace**
  - Use the helper in hit testing, drawing, and header rendering.

- [ ] **Step 3: Persist `moveTask`**
  - Make `moveTask` return `Promise<void>`.
  - Await it from drop handlers where practical.

- [ ] **Step 4: Run tests**
  - Run: `pnpm --filter @taskpulse/web test`
  - Expected: all web tests pass.

- [ ] **Step 5: Verify hierarchy persistence**
  - Move a task under a different parent through the store/API or UI.
  - Refresh data.
  - Expected: moved task retains the new `parentId`; cycle prevention still rejects invalid descendant drops.

---

## Task 4: Save Semantics and Error Feedback

**Files:**
- Modify: `apps/web/components/TaskDrawer.tsx`
- Modify: `apps/web/store/useStore.ts`
- Modify: `apps/web/app/page.tsx` or create a small error banner/toast component under `apps/web/components`

**Requirements:**
- Remove the misleading “Save Changes” behavior. Either:
  - implement local drawer draft state with Save/Cancel, or
  - relabel to “Close” and add visible saving/error state.
- For this remediation, prefer the smaller safe change: keep immediate persistence but relabel the button to `Close`, show a visible error banner when `error` is set, and avoid firing title updates on every keystroke by committing title on blur/Enter.
- Progress slider should commit on pointer/mouse release or use a light debounce, not every intermediate value.
- Date inputs should still persist directly, because they intentionally trigger auto-schedule.

- [ ] **Step 1: Add focused tests where feasible**
  - Store-level tests are acceptable if component test setup is absent.
  - At minimum keep API tests covering reduced network calls where practical.

- [ ] **Step 2: Implement visible error feedback**
  - Render store `error` in the app shell with a dismiss mechanism.

- [ ] **Step 3: Adjust TaskDrawer title/progress commit behavior**
  - Keep local input state synchronized when selecting a new task.
  - Commit title on blur or Enter only.
  - Commit progress on release or blur only.

- [ ] **Step 4: Run tests**
  - Run: `pnpm --filter @taskpulse/web test`
  - Expected: all web tests pass.

---

## Task 5: Final Verification

**Files:**
- Update if needed: `docs/testing/system-test-plan.md`

- [ ] Run: `pnpm test`
- [ ] Run: `pnpm build`
- [ ] Verify local API:
  - `curl -s 'http://localhost:3001/tasks?projectId=whisper-20260508'`
  - Expected: 102 tasks.
- [ ] Verify Excel-vs-API:
  - Expected: 0 date mismatches, 0 hierarchy mismatches, 0 dependency mismatches.
- [ ] Verify privacy:
  - Run `git status --short`.
  - Run `git diff --name-only`.
  - Confirm no Whisper Excel file, `apps/api/prisma/dev.db`, `.local-backups/*`, import reports, or derived real schedule data are tracked or staged.
- [ ] Verify manual UI smoke:
  - Open `http://localhost:5173`.
  - Whisper tasks before May are visible without broken mirroring.
  - Start and end columns show planned dates.
  - Dependency checkbox/type/lag changes survive refresh.
  - Hierarchy drag survives refresh.
  - Errors are visible if API is stopped.
