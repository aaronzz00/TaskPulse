import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { api } from '../services/api';
import { useStore } from './useStore';
import type { Task } from '../types';

const initialState = useStore.getState();
const originalApi = {
  fetchProjects: api.fetchProjects,
  fetchTasks: api.fetchTasks,
  fetchProjectOverview: api.fetchProjectOverview,
  createProject: api.createProject,
  duplicateProject: api.duplicateProject,
  importProjectFromExcel: api.importProjectFromExcel,
  chat: api.chat,
  updateTask: api.updateTask,
  createDependency: api.createDependency,
  updateDependency: api.updateDependency,
  deleteDependency: api.deleteDependency,
  batchUpdateTasks: api.batchUpdateTasks,
};

beforeEach(() => {
  useStore.setState({
    ...initialState,
    tasks: [task('task-1', 'Predecessor'), task('task-2', 'Current', { plannedStart: '2026-05-02', plannedEnd: '2026-05-03' })],
    error: null,
  }, true);
});

afterEach(() => {
  useStore.setState(initialState, true);
  api.updateTask = originalApi.updateTask;
  api.fetchProjects = originalApi.fetchProjects;
  api.fetchTasks = originalApi.fetchTasks;
  api.fetchProjectOverview = originalApi.fetchProjectOverview;
  api.createProject = originalApi.createProject;
  api.duplicateProject = originalApi.duplicateProject;
  api.importProjectFromExcel = originalApi.importProjectFromExcel;
  api.chat = originalApi.chat;
  api.createDependency = originalApi.createDependency;
  api.updateDependency = originalApi.updateDependency;
  api.deleteDependency = originalApi.deleteDependency;
  api.batchUpdateTasks = originalApi.batchUpdateTasks;
});

test('fetchData uses persisted current project id from localStorage', async () => {
  const storage = createMemoryStorage({ taskpulseCurrentProjectId: 'project-2' });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  api.fetchProjects = async () => [
    backendProject('project-1', 'First'),
    backendProject('project-2', 'Second'),
  ];
  api.fetchTasks = async (projectId) => [task('task-1', projectId)];
  api.fetchProjectOverview = async (projectId) => ({ id: projectId, name: projectId } as any);

  await useStore.getState().fetchData();

  assert.equal(useStore.getState().currentProjectId, 'project-2');
  assert.equal(useStore.getState().project?.name, 'project-2');
});

test('switchProject persists id and clears project scoped UI state', async () => {
  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  api.fetchProjects = async () => [backendProject('project-2', 'Second')];
  api.fetchTasks = async (projectId) => [task('task-1', projectId)];
  api.fetchProjectOverview = async (projectId) => ({ id: projectId, name: 'Second' } as any);
  useStore.setState({
    selectedTaskId: 'task-old',
    searchQuery: 'old query',
    activeSearchResultIndex: 2,
    aiMessages: [{ role: 'user', text: 'old' }],
  } as any);

  await useStore.getState().switchProject('project-2');

  assert.equal(storage.getItem('taskpulseCurrentProjectId'), 'project-2');
  assert.equal(useStore.getState().selectedTaskId, null);
  assert.equal(useStore.getState().searchQuery, '');
  assert.equal(useStore.getState().activeSearchResultIndex, -1);
  assert.deepEqual((useStore.getState() as any).aiMessages, []);
});

test('createBlankProject selects the created project and reloads data', async () => {
  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  api.createProject = async () => backendProject('project-new', 'New');
  api.fetchProjects = async () => [backendProject('project-new', 'New')];
  api.fetchTasks = async () => [];
  api.fetchProjectOverview = async () => ({ id: 'project-new', name: 'New' } as any);

  await useStore.getState().createBlankProject('New');

  assert.equal(useStore.getState().currentProjectId, 'project-new');
  assert.equal(storage.getItem('taskpulseCurrentProjectId'), 'project-new');
});

test('duplicateCurrentProject selects the copied project and reloads data', async () => {
  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  useStore.setState({ currentProjectId: 'project-1' });
  api.duplicateProject = async () => backendProject('project-copy', 'Copy');
  api.fetchProjects = async () => [backendProject('project-copy', 'Copy')];
  api.fetchTasks = async () => [];
  api.fetchProjectOverview = async () => ({ id: 'project-copy', name: 'Copy' } as any);

  await useStore.getState().duplicateCurrentProject('Copy');

  assert.equal(useStore.getState().currentProjectId, 'project-copy');
  assert.equal(storage.getItem('taskpulseCurrentProjectId'), 'project-copy');
});

test('importProjectFromExcel selects the imported project and reloads data', async () => {
  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  api.importProjectFromExcel = async () => backendProject('project-import', 'Imported');
  api.fetchProjects = async () => [backendProject('project-import', 'Imported')];
  api.fetchTasks = async () => [];
  api.fetchProjectOverview = async () => ({ id: 'project-import', name: 'Imported' } as any);

  await useStore.getState().importProjectFromExcel({ name: 'schedule.xlsx' } as File);

  assert.equal(useStore.getState().currentProjectId, 'project-import');
  assert.equal(storage.getItem('taskpulseCurrentProjectId'), 'project-import');
});

test('sendAIMessage appends user and real backend response without mutating tasks', async () => {
  api.chat = async (payload) => ({
    response: `Answer for ${payload.message}`,
    provider: 'Orka',
    model: 'gpt-5.4-mini',
    projectId: payload.projectId,
  });
  useStore.setState({
    currentProjectId: 'project-1',
    tasks: [task('task-1', 'Existing')],
    aiMessages: [],
  } as any);

  await useStore.getState().sendAIMessage('status?');

  assert.deepEqual(useStore.getState().tasks, [task('task-1', 'Existing')]);
  assert.deepEqual(useStore.getState().aiMessages, [
    { role: 'user', text: 'status?' },
    { role: 'ai', text: 'Answer for status?', provider: 'Orka', model: 'gpt-5.4-mini' },
  ]);
});

test('moveTask persists the dragged task parent id when moving inside another task', async () => {
  const updates: unknown[] = [];
  api.updateTask = async (id, update) => {
    updates.push({ id, update });
    return task(id, id, update);
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Dragged'),
      task('task-2', 'New parent'),
      task('task-3', 'Sibling'),
    ],
  });

  await useStore.getState().moveTask('task-1', 'task-2', 'inside');

  assert.deepEqual(updates, [{ id: 'task-1', update: { parentId: 'task-2' } }]);
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-1')?.parentId, 'task-2');
});

test('moveTask persists a null parent id when moving a child beside a root task', async () => {
  const updates: unknown[] = [];
  api.updateTask = async (id, update) => {
    updates.push({ id, update });
    return task(id, id, update as Partial<Task>);
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Parent'),
      task('task-2', 'Dragged child', { parentId: 'task-1' }),
      task('task-3', 'Root sibling'),
    ],
  });

  await useStore.getState().moveTask('task-2', 'task-3', 'before');

  assert.deepEqual(updates, [{ id: 'task-2', update: { parentId: null } }]);
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.parentId, undefined);
});

test('moveTask rolls back only hierarchy and order on failure while preserving concurrent edits', async () => {
  api.updateTask = async () => {
    useStore.setState({
      tasks: useStore.getState().tasks.map((candidate) => candidate.id === 'task-3'
        ? { ...candidate, title: 'Concurrent edit' }
        : candidate),
    });
    throw new Error('hierarchy update failed');
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Dragged'),
      task('task-2', 'New parent'),
      task('task-3', 'Other task'),
    ],
  });

  await useStore.getState().moveTask('task-1', 'task-2', 'inside');

  assert.deepEqual(useStore.getState().tasks.map((candidate) => candidate.id), ['task-1', 'task-2', 'task-3']);
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-1')?.parentId, undefined);
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-3')?.title, 'Concurrent edit');
  assert.equal(useStore.getState().error, 'hierarchy update failed');
});

test('updateTask can persist clearing a task parent while keeping local parent undefined', async () => {
  const updates: unknown[] = [];
  api.updateTask = async (id, update) => {
    updates.push({ id, update });
    return task(id, id, update as Partial<Task>);
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Parent'),
      task('task-2', 'Dragged child', { parentId: 'task-1' }),
    ],
  });

  await useStore.getState().updateTask('task-2', { parentId: null });

  assert.deepEqual(updates, [{ id: 'task-2', update: { parentId: null } }]);
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.parentId, undefined);
});

test('updateTask rolls back only failed fields while preserving later edits', async () => {
  api.updateTask = async () => {
    useStore.setState({
      tasks: useStore.getState().tasks.map((candidate) => {
        if (candidate.id === 'task-1') return { ...candidate, progress: 75 };
        if (candidate.id === 'task-2') return { ...candidate, title: 'Later successful edit' };
        return candidate;
      }),
    });
    throw new Error('title update failed');
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Original title', { progress: 10 }),
      task('task-2', 'Other task'),
    ],
  });

  await useStore.getState().updateTask('task-1', { title: 'Failed title' });

  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-1')?.title, 'Original title');
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-1')?.progress, 75);
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.title, 'Later successful edit');
  assert.equal(useStore.getState().error, 'title update failed');
});

test('updateTask rolls back autoscheduled dates without overwriting later edits', async () => {
  api.batchUpdateTasks = async () => {
    useStore.setState({
      tasks: useStore.getState().tasks.map((candidate) => {
        if (candidate.id === 'task-1') return { ...candidate, title: 'Later title edit' };
        if (candidate.id === 'task-2') return { ...candidate, progress: 50 };
        return candidate;
      }),
    });
    throw new Error('schedule update failed');
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Predecessor', { plannedStart: '2026-05-01', plannedEnd: '2026-05-08' }),
      task('task-2', 'Successor', {
        plannedStart: '2026-05-08',
        plannedEnd: '2026-05-09',
        dependencies: [{ id: 'dep-1', taskId: 'task-1', type: 'FS', lag: 0 }],
      }),
    ],
  });

  await useStore.getState().updateTask('task-1', { plannedEnd: '2026-05-10' });

  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-1')?.plannedEnd, '2026-05-08');
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-1')?.title, 'Later title edit');
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.plannedStart, '2026-05-08');
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.plannedEnd, '2026-05-09');
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.progress, 50);
  assert.equal(useStore.getState().error, 'schedule update failed');
});

test('createDependency persists source predecessor to current target and stores returned dependency id', async () => {
  const calls: unknown[] = [];
  api.createDependency = async (dependency) => {
    calls.push(dependency);
    return {
      id: 'dep-1',
      sourceTaskId: dependency.sourceTaskId,
      targetTaskId: dependency.targetTaskId,
      type: dependency.type ?? 'FS',
      lag: dependency.lag ?? 0,
      source: 'manual',
    };
  };
  api.batchUpdateTasks = async (updates) => updates.map((update) => ({
    ...task(update.id, update.id),
    ...update,
  }));

  await useStore.getState().createDependency('task-1', 'task-2');

  assert.deepEqual(calls, [{ sourceTaskId: 'task-1', targetTaskId: 'task-2', type: 'FS', lag: 0 }]);
  assert.deepEqual(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.dependencies, [
    { id: 'dep-1', taskId: 'task-1', type: 'FS', lag: 0 },
  ]);
});

test('createDependency does not create a duplicate dependency row', async () => {
  let calls = 0;
  api.createDependency = async () => {
    calls += 1;
    throw new Error('should not be called');
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Predecessor'),
      task('task-2', 'Current', { dependencies: [{ id: 'dep-1', taskId: 'task-1', type: 'FS', lag: 0 }] }),
    ],
  });

  await useStore.getState().createDependency('task-1', 'task-2');

  assert.equal(calls, 0);
});

test('updateDependency patches the row id and rolls back on failure', async () => {
  api.updateDependency = async () => {
    throw new Error('dependency update failed');
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Predecessor'),
      task('task-2', 'Current', { dependencies: [{ id: 'dep-1', taskId: 'task-1', type: 'FS', lag: 0 }] }),
    ],
  });

  await useStore.getState().updateDependency('task-2', 'dep-1', { type: 'SS', lag: 2 });

  assert.deepEqual(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.dependencies, [
    { id: 'dep-1', taskId: 'task-1', type: 'FS', lag: 0 },
  ]);
  assert.equal(useStore.getState().error, 'dependency update failed');
});

test('deleteDependency removes the row id and rolls back on failure', async () => {
  api.deleteDependency = async () => {
    throw new Error('dependency delete failed');
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Predecessor'),
      task('task-2', 'Current', { dependencies: [{ id: 'dep-1', taskId: 'task-1', type: 'FS', lag: 0 }] }),
    ],
  });

  await useStore.getState().deleteDependency('task-2', 'dep-1');

  assert.deepEqual(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.dependencies, [
    { id: 'dep-1', taskId: 'task-1', type: 'FS', lag: 0 },
  ]);
  assert.equal(useStore.getState().error, 'dependency delete failed');
});

test('createDependency reschedules a constrained target task', async () => {
  let scheduleUpdates: Array<Partial<Task> & { id: string }> = [];
  api.createDependency = async () => ({
    id: 'dep-1',
    sourceTaskId: 'task-1',
    targetTaskId: 'task-2',
    type: 'FS',
    lag: 0,
    source: 'manual',
  });
  api.batchUpdateTasks = async (updates) => {
    scheduleUpdates = updates;
    return updates.map((update) => ({
      ...task(update.id, update.id),
      ...update,
    }));
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Predecessor', { plannedStart: '2026-05-01', plannedEnd: '2026-05-08' }),
      task('task-2', 'Current', { plannedStart: '2026-05-02', plannedEnd: '2026-05-03' }),
    ],
  });

  await useStore.getState().createDependency('task-1', 'task-2');

  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.plannedStart, '2026-05-08');
  assert.deepEqual(scheduleUpdates, [{ id: 'task-2', plannedStart: '2026-05-08', plannedEnd: '2026-05-09' }]);
});

test('createDependency compensates the backend row and preserves concurrent edits when schedule persistence fails', async () => {
  const deletedDependencyIds: string[] = [];
  api.createDependency = async () => ({
    id: 'dep-1',
    sourceTaskId: 'task-1',
    targetTaskId: 'task-2',
    type: 'FS',
    lag: 0,
    source: 'manual',
  });
  api.batchUpdateTasks = async () => {
    useStore.setState({
      tasks: useStore.getState().tasks.map((candidate) => candidate.id === 'task-3'
        ? { ...candidate, title: 'Concurrent edit' }
        : candidate),
    });
    throw new Error('schedule persistence failed');
  };
  api.deleteDependency = async (id) => {
    deletedDependencyIds.push(id);
    return true;
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Predecessor', { plannedStart: '2026-05-01', plannedEnd: '2026-05-08' }),
      task('task-2', 'Current', { plannedStart: '2026-05-02', plannedEnd: '2026-05-03' }),
      task('task-3', 'Other task'),
    ],
  });

  await useStore.getState().createDependency('task-1', 'task-2');

  assert.deepEqual(deletedDependencyIds, ['dep-1']);
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.dependencies, undefined);
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.plannedStart, '2026-05-02');
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-3')?.title, 'Concurrent edit');
  assert.equal(useStore.getState().error, 'schedule persistence failed');
});

test('updateDependency compensates the backend row and preserves concurrent edits when schedule persistence fails', async () => {
  const patchCalls: Array<{ id: string; updates: unknown }> = [];
  api.updateDependency = async (id, updates) => {
    patchCalls.push({ id, updates });
    return {
      id,
      sourceTaskId: 'task-1',
      targetTaskId: 'task-2',
      type: (updates.type as 'FS' | 'SS' | 'FF' | 'SF') ?? 'FS',
      lag: updates.lag ?? 0,
      source: 'manual',
    };
  };
  api.batchUpdateTasks = async () => {
    useStore.setState({
      tasks: useStore.getState().tasks.map((candidate) => candidate.id === 'task-3'
        ? { ...candidate, title: 'Concurrent edit' }
        : candidate),
    });
    throw new Error('schedule persistence failed');
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Predecessor', { plannedStart: '2026-05-01', plannedEnd: '2026-05-08' }),
      task('task-2', 'Current', {
        plannedStart: '2026-05-01',
        plannedEnd: '2026-05-02',
        dependencies: [{ id: 'dep-1', taskId: 'task-1', type: 'SS', lag: 0 }],
      }),
      task('task-3', 'Other task'),
    ],
  });

  await useStore.getState().updateDependency('task-2', 'dep-1', { type: 'FS', lag: 0 });

  assert.deepEqual(patchCalls, [
    { id: 'dep-1', updates: { type: 'FS', lag: 0 } },
    { id: 'dep-1', updates: { type: 'SS', lag: 0 } },
  ]);
  assert.deepEqual(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.dependencies, [
    { id: 'dep-1', taskId: 'task-1', type: 'SS', lag: 0 },
  ]);
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.plannedStart, '2026-05-01');
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-3')?.title, 'Concurrent edit');
  assert.equal(useStore.getState().error, 'schedule persistence failed');
});

test('deleteDependency recalculates and persists target schedule from remaining predecessors', async () => {
  let scheduleUpdates: Array<Partial<Task> & { id: string }> = [];
  api.deleteDependency = async () => true;
  api.batchUpdateTasks = async (updates) => {
    scheduleUpdates = updates;
    return updates.map((update) => ({
      ...task(update.id, update.id),
      ...update,
    }));
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Later predecessor', { plannedStart: '2026-05-01', plannedEnd: '2026-05-08' }),
      task('task-3', 'Remaining predecessor', { plannedStart: '2026-05-01', plannedEnd: '2026-05-05' }),
      task('task-2', 'Current', {
        plannedStart: '2026-05-08',
        plannedEnd: '2026-05-09',
        dependencies: [
          { id: 'dep-1', taskId: 'task-1', type: 'FS', lag: 0 },
          { id: 'dep-2', taskId: 'task-3', type: 'FS', lag: 0 },
        ],
      }),
    ],
  });

  await useStore.getState().deleteDependency('task-2', 'dep-1');

  assert.deepEqual(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.dependencies, [
    { id: 'dep-2', taskId: 'task-3', type: 'FS', lag: 0 },
  ]);
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.plannedStart, '2026-05-05');
  assert.deepEqual(scheduleUpdates, [{ id: 'task-2', plannedStart: '2026-05-05', plannedEnd: '2026-05-06' }]);
});

test('deleteDependency compensates the backend row and preserves concurrent edits when schedule persistence fails', async () => {
  const recreatedDependencies: unknown[] = [];
  api.deleteDependency = async () => true;
  api.createDependency = async (dependency) => {
    recreatedDependencies.push(dependency);
    return {
      id: 'dep-recreated',
      sourceTaskId: dependency.sourceTaskId,
      targetTaskId: dependency.targetTaskId,
      type: dependency.type ?? 'FS',
      lag: dependency.lag ?? 0,
      source: 'manual',
    };
  };
  api.batchUpdateTasks = async () => {
    useStore.setState({
      tasks: useStore.getState().tasks.map((candidate) => candidate.id === 'task-4'
        ? { ...candidate, title: 'Concurrent edit' }
        : candidate),
    });
    throw new Error('schedule persistence failed');
  };
  useStore.setState({
    tasks: [
      task('task-1', 'Later predecessor', { plannedStart: '2026-05-01', plannedEnd: '2026-05-08' }),
      task('task-3', 'Remaining predecessor', { plannedStart: '2026-05-01', plannedEnd: '2026-05-05' }),
      task('task-2', 'Current', {
        plannedStart: '2026-05-08',
        plannedEnd: '2026-05-09',
        dependencies: [
          { id: 'dep-1', taskId: 'task-1', type: 'FS', lag: 0 },
          { id: 'dep-2', taskId: 'task-3', type: 'FS', lag: 0 },
        ],
      }),
      task('task-4', 'Other task'),
    ],
  });

  await useStore.getState().deleteDependency('task-2', 'dep-1');

  assert.deepEqual(recreatedDependencies, [{
    sourceTaskId: 'task-1',
    targetTaskId: 'task-2',
    type: 'FS',
    lag: 0,
  }]);
  assert.deepEqual(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.dependencies, [
    { id: 'dep-recreated', taskId: 'task-1', type: 'FS', lag: 0 },
    { id: 'dep-2', taskId: 'task-3', type: 'FS', lag: 0 },
  ]);
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-2')?.plannedStart, '2026-05-08');
  assert.equal(useStore.getState().tasks.find((candidate) => candidate.id === 'task-4')?.title, 'Concurrent edit');
  assert.equal(useStore.getState().error, 'schedule persistence failed');
});

test('clearError dismisses the current store error without changing tasks', () => {
  useStore.setState({
    error: 'network unavailable',
    tasks: [task('task-1', 'Existing task')],
  });

  const clearError = (useStore.getState() as unknown as { clearError?: () => void }).clearError;

  assert.equal(typeof clearError, 'function');
  clearError?.();
  assert.equal(useStore.getState().error, null);
  assert.deepEqual(useStore.getState().tasks, [task('task-1', 'Existing task')]);
});

test('setSearchQuery stores query and resets active search result', () => {
  useStore.setState({ searchQuery: 'old', activeSearchResultIndex: 2 });

  useStore.getState().setSearchQuery('verification');

  assert.equal(useStore.getState().searchQuery, 'verification');
  assert.equal(useStore.getState().activeSearchResultIndex, -1);
});

test('advanceSearchResult cycles through matching tasks', () => {
  useStore.setState({
    tasks: [
      task('whisper-001', 'Kickoff'),
      task('whisper-002', 'Verification plan'),
      task('whisper-003', 'Verification report'),
    ],
    searchQuery: 'verification',
    activeSearchResultIndex: -1,
  });

  useStore.getState().advanceSearchResult();
  assert.equal(useStore.getState().activeSearchResultIndex, 0);

  useStore.getState().advanceSearchResult();
  assert.equal(useStore.getState().activeSearchResultIndex, 1);

  useStore.getState().advanceSearchResult();
  assert.equal(useStore.getState().activeSearchResultIndex, 0);
});

test('setDependencyViewMode changes gantt dependency line mode', () => {
  useStore.setState({ dependencyViewMode: 'selected' });

  useStore.getState().setDependencyViewMode('critical');

  assert.equal(useStore.getState().dependencyViewMode, 'critical');
});

function task(id: string, title: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title,
    status: 'todo',
    priority: 'medium',
    plannedStart: '2026-05-01',
    plannedEnd: '2026-05-01',
    progress: 0,
    ...overrides,
  };
}

function backendProject(id: string, name: string) {
  return {
    id,
    name,
    description: '',
    startDate: '2026-05-10T00:00:00.000Z',
    endDate: '2026-05-10T00:00:00.000Z',
    status: 'active' as const,
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
  };
}

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  } as Storage;
}
