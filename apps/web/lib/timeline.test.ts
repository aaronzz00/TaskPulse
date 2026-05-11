import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  addDaysToDateOnly,
  buildVisibleTaskList,
  clampTimelineScrollX,
  getTodayScrollX,
  shiftDateOnlyRange,
  getDefaultTaskDates,
  getTimelineBounds,
  getTimelineStartDate,
  getXFromDate,
} from './timeline';
import type { Task } from '../types';

test('buildVisibleTaskList excludes collapsed descendants from the visible row sequence', () => {
  const visibleTasks = buildVisibleTaskList([
    task('root', { plannedStart: '2026-03-01' }),
    task('hidden-child', { parentId: 'root', plannedStart: '2026-02-01' }),
    task('visible-sibling', { plannedStart: '2026-04-01' }),
  ], new Set(['root']));

  assert.deepEqual(visibleTasks.map((visibleTask) => ({
    id: visibleTask.id,
    depth: visibleTask.depth,
    hasChildren: visibleTask.hasChildren,
  })), [
    { id: 'root', depth: 0, hasChildren: true },
    { id: 'visible-sibling', depth: 0, hasChildren: false },
  ]);
});

test('timeline origin can use all tasks even when the earliest child is hidden', () => {
  const allTasks = [
    task('root', { plannedStart: '2026-03-01' }),
    task('hidden-child', { parentId: 'root', plannedStart: '2026-02-01' }),
    task('visible-sibling', { plannedStart: '2026-04-01' }),
  ];
  const visibleTasks = buildVisibleTaskList(allTasks, new Set(['root']));

  assert.equal(visibleTasks.some((visibleTask) => visibleTask.id === 'hidden-child'), false);
  assert.equal(getTimelineStartDate(allTasks, 7).toISOString().slice(0, 10), '2026-01-25');
  assert.equal(getTimelineStartDate(visibleTasks, 7).toISOString().slice(0, 10), '2026-02-22');
});

test('getTimelineStartDate starts before the earliest planned task with a margin', () => {
  const start = getTimelineStartDate([
    task('feb-task', { plannedStart: '2026-02-24' }),
    task('may-task', { plannedStart: '2026-05-01' }),
  ], 7);

  assert.equal(start.toISOString().slice(0, 10), '2026-02-17');
  assert.equal(getXFromDate('2026-02-24', start, 20), 140);
});

test('getXFromDate returns negative x for dates before the timeline origin', () => {
  const timelineStart = new Date('2026-02-17T00:00:00.000Z');

  assert.equal(getXFromDate('2026-02-10', timelineStart, 20), -140);
});

test('getTimelineBounds spans earliest start to latest end with margins', () => {
  const bounds = getTimelineBounds([
    task('start', { plannedStart: '2026-03-10', plannedEnd: '2026-03-12' }),
    task('end', { plannedStart: '2026-04-01', plannedEnd: '2026-04-10' }),
  ], 7);

  assert.equal(bounds.startDate.toISOString().slice(0, 10), '2026-03-03');
  assert.equal(bounds.endDate.toISOString().slice(0, 10), '2026-04-17');
  assert.equal(bounds.totalDays, 45);
});

test('clampTimelineScrollX keeps horizontal scroll inside timeline bounds', () => {
  assert.equal(clampTimelineScrollX(-20, 45, 20, 300), 0);
  assert.equal(clampTimelineScrollX(250, 45, 20, 300), 250);
  assert.equal(clampTimelineScrollX(9999, 45, 20, 300), 600);
});

test('getTodayScrollX centers today and clamps outside dates to project bounds', () => {
  const bounds = getTimelineBounds([
    task('start', { plannedStart: '2026-03-10', plannedEnd: '2026-03-12' }),
    task('end', { plannedStart: '2026-04-01', plannedEnd: '2026-04-10' }),
  ], 7);

  assert.equal(getTodayScrollX(bounds, new Date('2026-03-20T12:00:00.000Z'), 20, 300), 190);
  assert.equal(getTodayScrollX(bounds, new Date('2026-02-01T00:00:00.000Z'), 20, 300), 0);
  assert.equal(getTodayScrollX(bounds, new Date('2026-05-01T00:00:00.000Z'), 20, 300), 600);
});

test('addDaysToDateOnly adds days in UTC date-only space', () => {
  assert.equal(addDaysToDateOnly('2026-05-01', 1), '2026-05-02');
});

test('shiftDateOnlyRange moves and resizes without local timezone conversion', () => {
  assert.deepEqual(shiftDateOnlyRange('2026-05-01', '2026-05-03', 1, 'move'), {
    plannedStart: '2026-05-02',
    plannedEnd: '2026-05-04',
  });
  assert.deepEqual(shiftDateOnlyRange('2026-05-01', '2026-05-03', 1, 'resize_left'), {
    plannedStart: '2026-05-02',
    plannedEnd: '2026-05-03',
  });
  assert.deepEqual(shiftDateOnlyRange('2026-05-01', '2026-05-03', 1, 'resize_right'), {
    plannedStart: '2026-05-01',
    plannedEnd: '2026-05-04',
  });
});

test('getDefaultTaskDates uses contextual dates instead of fixed May defaults', () => {
  assert.deepEqual(getDefaultTaskDates([
    task('feb-task', { plannedStart: '2026-02-24', plannedEnd: '2026-02-26' }),
    task('mar-task', { plannedStart: '2026-03-10', plannedEnd: '2026-03-11' }),
  ]), {
    plannedStart: '2026-02-24',
    plannedEnd: '2026-02-28',
  });

  assert.deepEqual(getDefaultTaskDates([], task('current', {
    plannedStart: '2026-04-03',
    plannedEnd: '2026-04-07',
  })), {
    plannedStart: '2026-04-03',
    plannedEnd: '2026-04-07',
  });
});

test('AI task creation does not use fixed May schedule dates', () => {
  const dirname = fileURLToPath(new URL('.', import.meta.url));
  const source = readFileSync(resolve(dirname, '../components/AISidebar.tsx'), 'utf8');

  assert.equal(source.includes("plannedStart: '2026-05-15'"), false);
  assert.equal(source.includes("plannedEnd: '2026-05-18'"), false);
});

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    status: 'todo',
    priority: 'medium',
    plannedStart: '2026-05-01',
    plannedEnd: '2026-05-01',
    progress: 0,
    ...overrides,
  };
}
