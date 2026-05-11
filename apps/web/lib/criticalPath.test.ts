import assert from 'node:assert/strict';
import test from 'node:test';
import type { Task } from '@/types';
import { calculateCriticalPath } from './criticalPath';

test('calculateCriticalPath marks the longest dependency chain and critical edges', () => {
  const result = calculateCriticalPath([
    task('a', { plannedStart: '2026-05-01', plannedEnd: '2026-05-03' }),
    task('b', {
      plannedStart: '2026-05-04',
      plannedEnd: '2026-05-05',
      dependencies: [{ id: 'dep-a-b', taskId: 'a', type: 'FS', lag: 0 }],
    }),
    task('c', { plannedStart: '2026-05-01', plannedEnd: '2026-05-01' }),
    task('d', {
      plannedStart: '2026-05-06',
      plannedEnd: '2026-05-06',
      dependencies: [
        { id: 'dep-b-d', taskId: 'b', type: 'FS', lag: 0 },
        { id: 'dep-c-d', taskId: 'c', type: 'FS', lag: 0 },
      ],
    }),
  ]);

  assert.deepEqual(result.criticalTaskIds, ['a', 'b', 'd']);
  assert.deepEqual(result.criticalDependencyIds, ['dep-a-b', 'dep-b-d']);
  assert.equal(result.slackByTaskId.c, 4);
});

test('calculateCriticalPath returns empty critical data for cyclic dependency input', () => {
  const result = calculateCriticalPath([
    task('a', {
      dependencies: [{ id: 'dep-b-a', taskId: 'b', type: 'FS', lag: 0 }],
    }),
    task('b', {
      dependencies: [{ id: 'dep-a-b', taskId: 'a', type: 'FS', lag: 0 }],
    }),
  ]);

  assert.deepEqual(result.criticalTaskIds, []);
  assert.deepEqual(result.criticalDependencyIds, []);
  assert.equal(result.hasCycle, true);
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
