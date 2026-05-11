import assert from 'node:assert/strict';
import test from 'node:test';
import type { Task } from '@/types';
import {
  getDependencyCandidateTasks,
  getTaskPathLabel,
} from './dependencyDisplay';

test('getTaskPathLabel includes compact id and parent context', () => {
  const tasks = [
    makeTask('whisper-001', 'Parent'),
    makeTask('whisper-002', 'Child', { parentId: 'whisper-001' }),
  ];

  assert.equal(getTaskPathLabel(tasks[1], tasks), 'W-002 Child / Parent');
});

test('getDependencyCandidateTasks excludes current task and existing dependencies', () => {
  const tasks = [
    makeTask('whisper-001', 'Source A'),
    makeTask('whisper-002', 'Current', {
      dependencies: [{ id: 'dep-1', taskId: 'whisper-001', type: 'FS', lag: 0 }],
    }),
    makeTask('whisper-003', 'Source B'),
  ];

  assert.deepEqual(getDependencyCandidateTasks(tasks[1], tasks, '').map((task) => task.id), ['whisper-003']);
});

test('getDependencyCandidateTasks filters candidates by id, title, status, and dates', () => {
  const tasks = [
    makeTask('whisper-001', 'Design review', { status: 'done' }),
    makeTask('whisper-002', 'Current'),
    makeTask('whisper-003', 'Verification package', { plannedEnd: '2026-04-12' }),
  ];

  assert.deepEqual(getDependencyCandidateTasks(tasks[1], tasks, 'W-001').map((task) => task.id), ['whisper-001']);
  assert.deepEqual(getDependencyCandidateTasks(tasks[1], tasks, 'verification').map((task) => task.id), ['whisper-003']);
  assert.deepEqual(getDependencyCandidateTasks(tasks[1], tasks, 'done').map((task) => task.id), ['whisper-001']);
  assert.deepEqual(getDependencyCandidateTasks(tasks[1], tasks, '2026-04-12').map((task) => task.id), ['whisper-003']);
});

function makeTask(id: string, title: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title,
    status: 'todo',
    priority: 'medium',
    plannedStart: '2026-04-01',
    plannedEnd: '2026-04-02',
    progress: 0,
    ...overrides,
  };
}
