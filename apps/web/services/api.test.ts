import assert from 'node:assert/strict';
import test from 'node:test';
import { api } from './api';

test('fetchTasks maps backend task responses into workspace tasks', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse([
      {
        id: 'task-2',
        projectId: 'project-1',
        parentId: null,
        title: 'Integrated task',
        description: '',
        status: 'in_progress',
        assigneeId: null,
        plannedStart: '2026-05-08T00:00:00.000Z',
        plannedEnd: '2026-05-10T00:00:00.000Z',
        actualStart: null,
        actualEnd: null,
        estimatedHours: 0,
        actualHours: 0,
        priority: 'high',
        progress: 40,
        dependencies: [
          { id: 'dep-1', sourceTaskId: 'task-1', targetTaskId: 'task-2', type: 'FS', lag: 0 },
        ],
      },
    ]);
  };

  try {
    const tasks = await api.fetchTasks('project-1');

    assert.equal(calls[0].url, 'http://localhost:3001/tasks?projectId=project-1');
    assert.deepEqual(tasks, [
      {
        id: 'task-2',
        title: 'Integrated task',
        status: 'in_progress',
        priority: 'high',
        plannedStart: '2026-05-08',
        plannedEnd: '2026-05-10',
        progress: 40,
        dependencies: [{ taskId: 'task-1', type: 'FS', lag: 0 }],
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('batchUpdateTasks sends one request for cascaded schedule updates', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse([]);
  };

  try {
    await api.batchUpdateTasks([
      { id: 'task-1', plannedStart: '2026-05-08', plannedEnd: '2026-05-11' },
      { id: 'task-2', progress: 50 },
    ]);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://localhost:3001/tasks/batch');
    assert.equal(calls[0].init?.method, 'PATCH');
    assert.equal(calls[0].init?.body, JSON.stringify({
      tasks: [
        { id: 'task-1', plannedStart: '2026-05-08', plannedEnd: '2026-05-11' },
        { id: 'task-2', progress: 50 },
      ],
    }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
