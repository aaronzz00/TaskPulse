import assert from 'node:assert/strict';
import test from 'node:test';
import { getTaskDisplayId } from './taskDisplay';

test('getTaskDisplayId turns imported Whisper ids into compact row ids', () => {
  assert.equal(getTaskDisplayId('whisper-001'), 'W-001');
  assert.equal(getTaskDisplayId('whisper-102'), 'W-102');
});

test('getTaskDisplayId prefers persisted display ids', () => {
  assert.equal(getTaskDisplayId({ id: 'cuid-task', displayId: 'T-014' }), 'T-014');
});

test('getTaskDisplayId keeps non-imported ids readable', () => {
  assert.equal(getTaskDisplayId('task-abc'), 'task-abc');
});
