# Task Visuals and Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Gantt dependency readability, give every task priority a distinct visual treatment, and expose editable task notes backed by the existing task `description` field.

**Architecture:** Keep the change incremental and aligned with the current monorepo. Use small frontend helper modules for visual tokens, extend shared contracts to carry `description` into `WorkspaceTask`, and reuse existing task update APIs because the backend already persists `Task.description`.

**Tech Stack:** Next.js, React, Zustand, Canvas 2D, NestJS, Prisma, TypeScript, `tsx --test`.

---

## File Structure

- Modify `docs/integration/frontend-improvement-guideline.md`: source guideline updated with the three requested improvement points.
- Modify `packages/contracts/src/types.ts`: add `description` to `WorkspaceTask`.
- Modify `packages/contracts/src/mappers.ts`: map `BackendTask.description` into workspace tasks.
- Modify `packages/contracts/src/mappers.test.ts`: assert description survives backend-to-workspace mapping.
- Create `apps/web/lib/taskVisuals.ts`: central visual tokens for priority badges, task bars, and dependency lines.
- Create `apps/web/lib/taskVisuals.test.ts`: unit tests for priority/dependency style selection.
- Modify `apps/web/lib/taskSearch.ts`: include task notes/description in search matching.
- Modify `apps/web/lib/taskSearch.test.ts`: add notes search coverage.
- Modify `apps/web/components/Workspace.tsx`: render priority visuals and improved dependency lines/legend.
- Modify `apps/web/components/TaskDrawer.tsx`: add editable Notes textarea with blur/keyboard commit behavior.
- Modify `apps/web/store/useStore.ts`: ensure create/update task payloads preserve `description`.
- Modify `apps/web/store/useStore.test.ts`: cover notes update/create behavior if current store tests do not already cover generic fields.
- Optionally modify `apps/api/src/tasks/tasks.service.spec.ts`: only if backend tests lack `description` update persistence coverage.

## Design Decisions

- Use `description` as the task notes field. Do not add a new database column unless product later needs separate “formal description” and “free-form notes”.
- Keep status as the task bar body color. Priority should be a secondary visual cue: badge in the list plus a slim stripe or outline in the Gantt bar.
- Critical path remains the strongest visual state. A critical path outline can coexist with priority color, but it must not be replaced by priority color.
- Dependency style must not rely on color alone. Normal, selected, and critical dependencies should differ by color, opacity, width, and dash pattern.
- Keep the first implementation compact: no rich text editor for notes, no markdown preview, no dependency labels on every line.

---

### Task 1: Extend Workspace Task Notes Data

**Files:**
- Modify: `packages/contracts/src/types.ts`
- Modify: `packages/contracts/src/mappers.ts`
- Modify: `packages/contracts/src/mappers.test.ts`

- [ ] **Step 1: Write the failing mapper test**

Add or update a test in `packages/contracts/src/mappers.test.ts`:

```ts
assert.equal(mapped.description, 'Launch checklist notes');
```

Use a backend task fixture where `description: 'Launch checklist notes'`.

- [ ] **Step 2: Run the contracts test to verify it fails**

Run:

```bash
pnpm --filter @taskpulse/contracts test
```

Expected: FAIL because `WorkspaceTask` does not expose or map `description`.

- [ ] **Step 3: Add description to the shared type and mapper**

In `packages/contracts/src/types.ts`, update `WorkspaceTask`:

```ts
description: string;
```

In `packages/contracts/src/mappers.ts`, update `mapBackendTaskToWorkspaceTask`:

```ts
description: task.description ?? '',
```

- [ ] **Step 4: Run the contracts test**

Run:

```bash
pnpm --filter @taskpulse/contracts test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/types.ts packages/contracts/src/mappers.ts packages/contracts/src/mappers.test.ts
git commit -m "feat(contracts): expose task notes in workspace tasks"
```

---

### Task 2: Add Priority and Dependency Visual Tokens

**Files:**
- Create: `apps/web/lib/taskVisuals.ts`
- Create: `apps/web/lib/taskVisuals.test.ts`

- [ ] **Step 1: Write visual token tests**

Create `apps/web/lib/taskVisuals.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { getDependencyLineStyle, getPriorityVisual } from './taskVisuals';

test('priority visuals cover every task priority', () => {
  for (const priority of ['low', 'medium', 'high', 'critical'] as const) {
    const visual = getPriorityVisual(priority);
    assert.ok(visual.badgeClass);
    assert.ok(visual.ganttAccent);
    assert.ok(visual.label);
  }
});

test('dependency line style makes normal dependencies more visible than grid lines', () => {
  const style = getDependencyLineStyle({ isCritical: false, isSelected: false, type: 'FS' });
  assert.equal(style.strokeStyle, '#475569');
  assert.ok(style.lineWidth >= 1.75);
  assert.ok(style.alpha >= 0.7);
});

test('critical dependency style remains strongest', () => {
  const style = getDependencyLineStyle({ isCritical: true, isSelected: false, type: 'FS' });
  assert.equal(style.strokeStyle, '#dc2626');
  assert.equal(style.lineDash.length, 0);
  assert.ok(style.lineWidth >= 2.5);
});
```

- [ ] **Step 2: Run the web test to verify it fails**

Run:

```bash
pnpm --filter @taskpulse/web test
```

Expected: FAIL because `taskVisuals.ts` does not exist.

- [ ] **Step 3: Implement `taskVisuals.ts`**

Create `apps/web/lib/taskVisuals.ts`:

```ts
import type { DependencyType, TaskPriority } from '@taskpulse/contracts';

export function getPriorityVisual(priority: TaskPriority) {
  switch (priority) {
    case 'low':
      return {
        label: 'Low',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        rowAccentClass: 'before:bg-emerald-400',
        ganttAccent: '#10b981',
      };
    case 'high':
      return {
        label: 'High',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        rowAccentClass: 'before:bg-amber-400',
        ganttAccent: '#f59e0b',
      };
    case 'critical':
      return {
        label: 'Critical',
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        rowAccentClass: 'before:bg-red-500',
        ganttAccent: '#dc2626',
      };
    case 'medium':
    default:
      return {
        label: 'Medium',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        rowAccentClass: 'before:bg-slate-400',
        ganttAccent: '#64748b',
      };
  }
}

export function getDependencyLineStyle(input: {
  isCritical: boolean;
  isSelected: boolean;
  type: DependencyType;
}) {
  if (input.isCritical) {
    return { strokeStyle: '#dc2626', lineWidth: 2.75, alpha: 1, lineDash: [] as number[] };
  }

  if (input.isSelected) {
    return { strokeStyle: '#4f46e5', lineWidth: 2.5, alpha: 0.95, lineDash: [] as number[] };
  }

  const lineDashByType: Record<DependencyType, number[]> = {
    FS: [7, 4],
    SS: [3, 3],
    FF: [10, 4, 2, 4],
    SF: [2, 4],
  };

  return {
    strokeStyle: '#475569',
    lineWidth: 1.75,
    alpha: 0.72,
    lineDash: lineDashByType[input.type],
  };
}
```

- [ ] **Step 4: Run the web test**

Run:

```bash
pnpm --filter @taskpulse/web test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/taskVisuals.ts apps/web/lib/taskVisuals.test.ts
git commit -m "feat(web): add task visual style tokens"
```

---

### Task 3: Improve Dependency Lines and Add Legend

**Files:**
- Modify: `apps/web/components/Workspace.tsx`
- Test: `apps/web/lib/taskVisuals.test.ts`

- [ ] **Step 1: Add an assertion for dependency type dash patterns**

Extend `apps/web/lib/taskVisuals.test.ts`:

```ts
test('dependency types have distinct normal dash patterns', () => {
  const patterns = new Set(
    (['FS', 'SS', 'FF', 'SF'] as const).map((type) =>
      getDependencyLineStyle({ isCritical: false, isSelected: false, type }).lineDash.join(',')
    )
  );
  assert.equal(patterns.size, 4);
});
```

- [ ] **Step 2: Run the focused web tests**

Run:

```bash
pnpm --filter @taskpulse/web test
```

Expected: PASS if Task 2 already implemented distinct patterns.

- [ ] **Step 3: Use visual tokens in canvas dependency drawing**

In `apps/web/components/Workspace.tsx`:

```ts
import { getDependencyLineStyle, getPriorityVisual } from '@/lib/taskVisuals';
```

Replace the current dependency style block:

```ts
const lineStyle = getDependencyLineStyle({
  isCritical: isCriticalDependency,
  isSelected: isSelectedDependency,
  type: dep.type,
});

ctx.save();
ctx.globalAlpha = lineStyle.alpha;
ctx.strokeStyle = lineStyle.strokeStyle;
ctx.fillStyle = lineStyle.strokeStyle;
ctx.lineWidth = lineStyle.lineWidth;
ctx.setLineDash(lineStyle.lineDash);
...
ctx.restore();
```

Keep arrowheads filled with the same stroke color.

- [ ] **Step 4: Add a compact dependency legend**

Near the dependency mode segmented control in `Workspace.tsx`, add a small legend:

```tsx
<div className="absolute top-[5.6rem] right-4 z-20 flex items-center gap-3 rounded border border-slate-200 bg-white/95 px-2 py-1 text-[10px] text-slate-500 shadow-sm">
  <span className="inline-flex items-center gap-1"><i className="h-0.5 w-5 bg-red-600" /> Critical</span>
  <span className="inline-flex items-center gap-1"><i className="h-0.5 w-5 bg-indigo-600" /> Selected</span>
  <span className="inline-flex items-center gap-1"><i className="h-0.5 w-5 border-t-2 border-dashed border-slate-600" /> Normal</span>
</div>
```

Ensure it does not overlap the existing `Today` and dependency mode controls.

- [ ] **Step 5: Run verification**

Run:

```bash
pnpm --filter @taskpulse/web test
pnpm --filter @taskpulse/web build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/Workspace.tsx apps/web/lib/taskVisuals.test.ts
git commit -m "feat(web): improve dependency line readability"
```

---

### Task 4: Add Priority Visuals to Task List and Gantt Bars

**Files:**
- Modify: `apps/web/components/Workspace.tsx`
- Test: `apps/web/lib/taskVisuals.test.ts`

- [ ] **Step 1: Add priority visual coverage test if not already present**

Confirm `apps/web/lib/taskVisuals.test.ts` checks all four priority values.

- [ ] **Step 2: Add priority badge to task rows**

In `Workspace.tsx`, inside the task title cell:

```tsx
const priorityVisual = getPriorityVisual(task.priority);
```

Render a compact badge near the task title or before status:

```tsx
<span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${priorityVisual.badgeClass}`}>
  {priorityVisual.label}
</span>
```

If horizontal space is tight, shorten labels to `L`, `M`, `H`, `C` and use `title={priorityVisual.label}`.

- [ ] **Step 3: Add priority accent to Gantt bars**

In `drawTaskBar`, after drawing the task bar body:

```ts
const priorityVisual = getPriorityVisual(task.priority);
ctx.fillStyle = priorityVisual.ganttAccent;
ctx.beginPath();
ctx.roundRect(startX, y, Math.min(6, w), 24, [12, 0, 0, 12]);
ctx.fill();
```

Keep critical path border rendering after this accent so critical path remains dominant.

- [ ] **Step 4: Review row highlight precedence**

In row class construction, keep active search and drag-over styles strongest. Critical path may tint the row, but priority should use badge/accent instead of additional row background to avoid color stacking.

- [ ] **Step 5: Run verification**

Run:

```bash
pnpm --filter @taskpulse/web test
pnpm --filter @taskpulse/web build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/Workspace.tsx
git commit -m "feat(web): distinguish task priority visually"
```

---

### Task 5: Add Editable Task Notes

**Files:**
- Modify: `apps/web/components/TaskDrawer.tsx`
- Modify: `apps/web/lib/taskSearch.ts`
- Modify: `apps/web/lib/taskSearch.test.ts`
- Modify: `apps/web/store/useStore.ts`
- Modify: `apps/web/store/useStore.test.ts`

- [ ] **Step 1: Write search test for notes**

In `apps/web/lib/taskSearch.test.ts`, add a task with:

```ts
description: 'Vendor signoff is blocked by security review'
```

Assert:

```ts
assert.equal(taskMatchesSearch(task, 'security review'), true);
```

- [ ] **Step 2: Run web tests to verify failure**

Run:

```bash
pnpm --filter @taskpulse/web test
```

Expected: FAIL if search only checks ID/title/status/date.

- [ ] **Step 3: Include description in search**

In `apps/web/lib/taskSearch.ts`, include `task.description ?? ''` in the searchable text list.

- [ ] **Step 4: Add notes draft state to TaskDrawer**

In `TaskDrawer.tsx`, add:

```ts
const [notesDraft, setNotesDraft] = React.useState('');
const lastNotesCommitRef = React.useRef('');
```

Reset drafts when selected task changes:

```ts
setNotesDraft(task?.description ?? '');
lastNotesCommitRef.current = task?.description ?? '';
```

Add commit callback:

```ts
const commitNotes = React.useCallback(() => {
  if (!task || notesDraft === (task.description ?? '') || notesDraft === lastNotesCommitRef.current) return;
  lastNotesCommitRef.current = notesDraft;
  updateTask(task.id, { description: notesDraft });
}, [notesDraft, task, updateTask]);
```

- [ ] **Step 5: Render Notes textarea**

Add a section below Title or before Dependencies:

```tsx
<div>
  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Notes</label>
  <textarea
    value={notesDraft}
    onChange={(event) => setNotesDraft(event.target.value)}
    onBlur={commitNotes}
    rows={5}
    placeholder="Add task notes, assumptions, risks, or handoff context"
    className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
  />
</div>
```

Do not commit on every keystroke.

- [ ] **Step 6: Ensure createTask passes description**

In `Workspace.tsx` or store defaults, ensure new task and subtask payloads include:

```ts
description: ''
```

If `useStore.createTask` already defaults missing description safely through API DTOs, still prefer explicit frontend defaults for type consistency.

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm --filter @taskpulse/web test
pnpm --filter @taskpulse/web build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/TaskDrawer.tsx apps/web/components/Workspace.tsx apps/web/lib/taskSearch.ts apps/web/lib/taskSearch.test.ts apps/web/store/useStore.ts apps/web/store/useStore.test.ts
git commit -m "feat(web): add editable task notes"
```

---

### Task 6: Backend and Snapshot Safety Check

**Files:**
- Inspect: `apps/api/src/schedule-versions/schedule-versions.service.ts`
- Inspect: `apps/api/src/tasks/tasks.service.ts`
- Optional Modify/Test: `apps/api/src/tasks/tasks.service.spec.ts`

- [ ] **Step 1: Confirm backend DTO support**

Verify `CreateTaskDto` and `UpdateTaskDto` already include:

```ts
description?: string;
```

Expected: already present.

- [ ] **Step 2: Confirm schedule snapshot includes task description**

Verify `ScheduleVersionsService` snapshots and restores:

```ts
description: task.description
```

Expected: already present.

- [ ] **Step 3: Add backend test only if missing coverage matters**

If `tasks.service.spec.ts` does not cover update payload pass-through, add a focused test that `description` is passed to Prisma update.

- [ ] **Step 4: Run API tests**

Run:

```bash
pnpm --filter @taskpulse/api test
```

Expected: PASS.

- [ ] **Step 5: Commit if code/tests changed**

```bash
git add apps/api/src/tasks/tasks.service.spec.ts
git commit -m "test(api): cover task notes persistence"
```

Skip commit if this task only confirms existing support.

---

### Task 7: Full Verification

**Files:**
- No direct file changes unless verification exposes defects.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @taskpulse/contracts test
pnpm --filter @taskpulse/web test
pnpm --filter @taskpulse/api test
```

Expected: PASS.

- [ ] **Step 2: Run full build**

Run:

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 3: Optional manual smoke**

Start local services per `README.md`, then verify:

- Normal dependency lines are visible in `all` mode.
- Selected dependency lines remain distinguishable.
- Critical path dependencies remain red and dominant.
- Low/medium/high/critical priorities are visually distinct in task list and Gantt bars.
- Notes can be edited in the task drawer, persist after selection change, and match search.

- [ ] **Step 4: Final commit if verification fixes were needed**

```bash
git status --short
git add <fixed-files>
git commit -m "fix: stabilize task visuals and notes"
```

Expected final state: clean working tree after all commits.
