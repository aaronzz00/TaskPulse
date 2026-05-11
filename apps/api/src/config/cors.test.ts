import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCorsOrigin } from './cors';

test('resolveCorsOrigin defaults to the local TaskPulse web origins', () => {
  assert.deepEqual(resolveCorsOrigin({}), [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
});

test('resolveCorsOrigin parses comma-separated deployment origins', () => {
  assert.deepEqual(resolveCorsOrigin({
    TASKPULSE_CORS_ORIGIN: 'https://taskpulse.example.com, http://localhost:5173 ',
  }), [
    'https://taskpulse.example.com',
    'http://localhost:5173',
  ]);
});
