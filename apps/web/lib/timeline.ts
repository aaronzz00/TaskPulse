import type { Task } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MARGIN_DAYS = 7;
const DEFAULT_TASK_DURATION_DAYS = 4;

export type VisibleTask = Task & { depth: number; hasChildren: boolean };
export interface TimelineBounds {
  startDate: Date;
  endDate: Date;
  totalDays: number;
}

export function buildVisibleTaskList(tasks: Task[], collapsedTaskIds: ReadonlySet<string> = new Set()): VisibleTask[] {
  const result: VisibleTask[] = [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const childrenByParent = new Map<string | undefined, Task[]>();
  const visited = new Set<string>();

  for (const task of tasks) {
    const parentId = task.parentId && taskById.has(task.parentId) ? task.parentId : undefined;
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) || []), task]);
  }

  const appendChildren = (parentId: string | undefined, depth: number, isHidden: boolean) => {
    const children = childrenByParent.get(parentId) || [];

    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);

      const hasChildren = (childrenByParent.get(child.id) || []).length > 0;
      if (!isHidden) {
        result.push({ ...child, depth, hasChildren });
      }

      appendChildren(child.id, depth + 1, isHidden || collapsedTaskIds.has(child.id));
    }
  };

  appendChildren(undefined, 0, false);

  return result;
}

export function getTimelineStartDate(tasks: Pick<Task, 'plannedStart'>[], marginDays = DEFAULT_MARGIN_DAYS): Date {
  const plannedStarts = tasks
    .map((task) => parseDateOnlyUtc(task.plannedStart).getTime())
    .filter((time) => Number.isFinite(time));

  if (plannedStarts.length === 0) {
    return startOfUtcDay(new Date());
  }

  return new Date(Math.min(...plannedStarts) - marginDays * DAY_MS);
}

export function getTimelineBounds(
  tasks: Pick<Task, 'plannedStart' | 'plannedEnd'>[],
  marginDays = DEFAULT_MARGIN_DAYS,
): TimelineBounds {
  const starts = tasks
    .map((task) => parseDateOnlyUtc(task.plannedStart).getTime())
    .filter((time) => Number.isFinite(time));
  const ends = tasks
    .map((task) => parseDateOnlyUtc(task.plannedEnd).getTime())
    .filter((time) => Number.isFinite(time));

  if (starts.length === 0 || ends.length === 0) {
    const today = startOfUtcDay(new Date());
    const startDate = new Date(today.getTime() - marginDays * DAY_MS);
    const endDate = new Date(today.getTime() + marginDays * DAY_MS);
    return {
      startDate,
      endDate,
      totalDays: Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / DAY_MS)),
    };
  }

  const startDate = new Date(Math.min(...starts) - marginDays * DAY_MS);
  const endDate = new Date(Math.max(...ends) + marginDays * DAY_MS);

  return {
    startDate,
    endDate,
    totalDays: Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / DAY_MS)),
  };
}

export function getXFromDate(dateString: string, timelineStartDate: Date, dayWidth: number): number {
  const date = parseDateOnlyUtc(dateString);
  const diffDays = (date.getTime() - timelineStartDate.getTime()) / DAY_MS;
  return diffDays * dayWidth;
}

export function clampTimelineScrollX(scrollX: number, totalDays: number, dayWidth: number, viewportWidth: number): number {
  const maxScrollX = Math.max(0, totalDays * dayWidth - viewportWidth);
  return Math.min(maxScrollX, Math.max(0, scrollX));
}

export function getTodayScrollX(bounds: TimelineBounds, today: Date, dayWidth: number, viewportWidth: number): number {
  const todayStart = startOfUtcDay(today);
  const todayX = ((todayStart.getTime() - bounds.startDate.getTime()) / DAY_MS) * dayWidth;
  return clampTimelineScrollX(todayX - viewportWidth / 2, bounds.totalDays, dayWidth, viewportWidth);
}

export function addDaysToDateOnly(dateString: string, days: number): string {
  return formatDateOnly(new Date(parseDateOnlyUtc(dateString).getTime() + days * DAY_MS));
}

export function shiftDateOnlyRange(
  plannedStart: string,
  plannedEnd: string,
  deltaDays: number,
  mode: 'move' | 'resize_left' | 'resize_right',
) {
  if (mode === 'move') {
    return {
      plannedStart: addDaysToDateOnly(plannedStart, deltaDays),
      plannedEnd: addDaysToDateOnly(plannedEnd, deltaDays),
    };
  }

  if (mode === 'resize_left') {
    const nextStart = addDaysToDateOnly(plannedStart, deltaDays);
    return {
      plannedStart: compareDateOnly(nextStart, plannedEnd) > 0 ? plannedEnd : nextStart,
      plannedEnd,
    };
  }

  const nextEnd = addDaysToDateOnly(plannedEnd, deltaDays);
  return {
    plannedStart,
    plannedEnd: compareDateOnly(nextEnd, plannedStart) < 0 ? plannedStart : nextEnd,
  };
}

export function getDefaultTaskDates(tasks: Pick<Task, 'plannedStart' | 'plannedEnd'>[], contextTask?: Pick<Task, 'plannedStart' | 'plannedEnd'>) {
  if (contextTask) {
    return {
      plannedStart: contextTask.plannedStart,
      plannedEnd: contextTask.plannedEnd,
    };
  }

  const timelineStart = getTimelineStartDate(tasks, 0);
  const plannedEnd = new Date(timelineStart.getTime() + DEFAULT_TASK_DURATION_DAYS * DAY_MS);

  return {
    plannedStart: formatDateOnly(timelineStart),
    plannedEnd: formatDateOnly(plannedEnd),
  };
}

function parseDateOnlyUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function compareDateOnly(left: string, right: string) {
  return parseDateOnlyUtc(left).getTime() - parseDateOnlyUtc(right).getTime();
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
