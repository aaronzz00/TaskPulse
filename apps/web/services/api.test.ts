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
        dependencies: [{ id: 'dep-1', taskId: 'task-1', type: 'FS', lag: 0 }],
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

test('createDependency posts a dependency row and maps the response', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({
      id: 'dep-1',
      sourceTaskId: 'task-1',
      targetTaskId: 'task-2',
      type: 'FS',
      lag: 0,
      source: 'manual',
    });
  };

  try {
    const dependency = await api.createDependency({
      sourceTaskId: 'task-1',
      targetTaskId: 'task-2',
      type: 'FS',
      lag: 0,
    });

    assert.equal(calls[0].url, 'http://localhost:3001/dependencies');
    assert.equal(calls[0].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      sourceTaskId: 'task-1',
      targetTaskId: 'task-2',
      type: 'FS',
      lag: 0,
      source: 'manual',
    });
    assert.deepEqual(dependency, {
      id: 'dep-1',
      sourceTaskId: 'task-1',
      targetTaskId: 'task-2',
      type: 'FS',
      lag: 0,
      source: 'manual',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('updateDependency patches dependency type and lag', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({
      id: 'dep-1',
      sourceTaskId: 'task-1',
      targetTaskId: 'task-2',
      type: 'SS',
      lag: 3,
      source: 'manual',
    });
  };

  try {
    const dependency = await api.updateDependency('dep-1', { type: 'SS', lag: 3 });

    assert.equal(calls[0].url, 'http://localhost:3001/dependencies/dep-1');
    assert.equal(calls[0].init?.method, 'PATCH');
    assert.equal(calls[0].init?.body, JSON.stringify({ type: 'SS', lag: 3 }));
    assert.equal(dependency.type, 'SS');
    assert.equal(dependency.lag, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deleteDependency deletes a dependency row by id', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({
      id: 'dep-1',
      sourceTaskId: 'task-1',
      targetTaskId: 'task-2',
      type: 'FS',
      lag: 0,
      source: 'manual',
    });
  };

  try {
    await api.deleteDependency('dep-1');

    assert.equal(calls[0].url, 'http://localhost:3001/dependencies/dep-1');
    assert.equal(calls[0].init?.method, 'DELETE');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createProject posts a blank project', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({
      id: 'project-2',
      name: 'New Project',
      description: '',
      startDate: '2026-05-10T00:00:00.000Z',
      endDate: '2026-05-10T00:00:00.000Z',
      status: 'draft',
      createdAt: '2026-05-10T00:00:00.000Z',
      updatedAt: '2026-05-10T00:00:00.000Z',
    });
  };

  try {
    const project = await api.createProject({ name: 'New Project' });

    assert.equal(calls[0].url, 'http://localhost:3001/projects');
    assert.equal(calls[0].init?.method, 'POST');
    assert.equal(project.id, 'project-2');
    assert.equal(JSON.parse(String(calls[0].init?.body)).name, 'New Project');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('duplicateProject posts to project duplicate endpoint', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({
      id: 'project-copy',
      name: 'Copy',
      description: '',
      startDate: '2026-05-10T00:00:00.000Z',
      endDate: '2026-05-10T00:00:00.000Z',
      status: 'draft',
      createdAt: '2026-05-10T00:00:00.000Z',
      updatedAt: '2026-05-10T00:00:00.000Z',
    });
  };

  try {
    const project = await api.duplicateProject('project-1', { name: 'Copy' });

    assert.equal(calls[0].url, 'http://localhost:3001/projects/project-1/duplicate');
    assert.equal(calls[0].init?.method, 'POST');
    assert.equal(calls[0].init?.body, JSON.stringify({ name: 'Copy' }));
    assert.equal(project.id, 'project-copy');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('importProjectFromExcel posts multipart form data without json content type', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({
      id: 'project-import',
      name: 'Imported',
      description: '',
      startDate: '2026-05-10T00:00:00.000Z',
      endDate: '2026-05-10T00:00:00.000Z',
      status: 'active',
      createdAt: '2026-05-10T00:00:00.000Z',
      updatedAt: '2026-05-10T00:00:00.000Z',
    });
  };

  try {
    const file = new File(['xlsx'], 'schedule.xlsx');
    const project = await api.importProjectFromExcel(file, 'Imported');

    assert.equal(calls[0].url, 'http://localhost:3001/projects/import');
    assert.equal(calls[0].init?.method, 'POST');
    assert.ok(calls[0].init?.body instanceof FormData);
    assert.equal(calls[0].init?.headers, undefined);
    assert.equal(project.id, 'project-import');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('schedule version methods call project-scoped endpoints', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ id: 'version-1', name: 'Baseline' });
  };

  try {
    await api.createScheduleVersion('project-1', { name: 'Baseline', isBaseline: true });
    await api.fetchScheduleVersions('project-1');
    await api.restoreScheduleVersion('project-1', 'version-1');

    assert.equal(calls[0].url, 'http://localhost:3001/projects/project-1/schedule-versions');
    assert.equal(calls[0].init?.method, 'POST');
    assert.equal(calls[1].url, 'http://localhost:3001/projects/project-1/schedule-versions');
    assert.equal(calls[2].url, 'http://localhost:3001/projects/project-1/schedule-versions/version-1/restore');
    assert.equal(calls[2].init?.method, 'POST');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AI provider and chat methods call backend endpoints', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ ok: true, response: 'answer' });
  };

  try {
    await api.fetchAIProviders();
    await api.createAIProvider({ name: 'Orka', provider: 'openai-compatible', model: 'gpt-5.4-mini', apiKey: 'secret' });
    await api.testAIProvider('provider-1');
    await api.setDefaultAIProvider('provider-1');
    await api.chat({ projectId: 'project-1', message: 'status?' });

    assert.equal(calls[0].url, 'http://localhost:3001/ai/providers');
    assert.equal(calls[1].url, 'http://localhost:3001/ai/providers');
    assert.equal(calls[1].init?.method, 'POST');
    assert.equal(calls[2].url, 'http://localhost:3001/ai/providers/provider-1/test');
    assert.equal(calls[3].url, 'http://localhost:3001/ai/providers/provider-1/default');
    assert.equal(calls[4].url, 'http://localhost:3001/ai/chat');
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
