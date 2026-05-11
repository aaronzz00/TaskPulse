import assert from 'node:assert/strict';
import test from 'node:test';
import type { Task } from '@/types';
import {
  advanceSearchResult,
  buildSearchExpansion,
  getSearchResults,
  taskMatchesSearch,
} from './taskSearch';

test('taskMatchesSearch searches display id, title, status, and dates', () => {
  const task = makeTask('whisper-017', 'Design verification package', {
    displayId: 'W-017',
    status: 'in_progress',
    plannedStart: '2026-03-10',
    plannedEnd: '2026-03-12',
  });

  assert.equal(taskMatchesSearch(task, 'W-017'), true);
  assert.equal(taskMatchesSearch(task, 'verification'), true);
  assert.equal(taskMatchesSearch(task, 'in progress'), true);
  assert.equal(taskMatchesSearch(task, '2026-03-12'), true);
  assert.equal(taskMatchesSearch(makeTask('cuid-task', 'Generated task', { displayId: 'T-014' }), 'T-014'), true);
  assert.equal(taskMatchesSearch(task, 'regulatory'), false);
});

test('getSearchResults returns matching ids in visible order', () => {
  const tasks = [
    makeTask('whisper-001', 'Project kickoff'),
    makeTask('whisper-002', 'Verification plan'),
    makeTask('whisper-003', 'Verification report'),
  ];

  assert.deepEqual(getSearchResults(tasks, 'verification'), ['whisper-002', 'whisper-003']);
});

test('buildSearchExpansion expands ancestors of matching child tasks', () => {
  const tasks = [
    makeTask('whisper-001', 'Parent'),
    makeTask('whisper-002', 'Child target', { parentId: 'whisper-001' }),
    makeTask('whisper-003', 'Grandchild target', { parentId: 'whisper-002' }),
  ];

  assert.deepEqual([...buildSearchExpansion(tasks, ['whisper-003'])], ['whisper-001', 'whisper-002']);
});

test('advanceSearchResult cycles through result indices', () => {
  assert.equal(advanceSearchResult(0, 3), 1);
  assert.equal(advanceSearchResult(2, 3), 0);
  assert.equal(advanceSearchResult(-1, 3), 0);
  assert.equal(advanceSearchResult(0, 0), -1);
});

function makeTask(id: string, title: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title,
    status: 'todo',
    priority: 'medium',
    plannedStart: '2026-03-01',
    plannedEnd: '2026-03-02',
    progress: 0,
    ...overrides,
  };
}
