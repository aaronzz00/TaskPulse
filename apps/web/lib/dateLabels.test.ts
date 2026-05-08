import assert from 'node:assert/strict';
import test from 'node:test';
import { formatShortDate } from './dateLabels';

test('formatShortDate returns month and day for task date columns', () => {
  assert.equal(formatShortDate('2026-05-20'), '05-20');
});
