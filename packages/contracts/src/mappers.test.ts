import assert from 'node:assert/strict';
import test from 'node:test';
import { mapBackendTaskToWorkspaceTask, mapBackendProjectToWorkspaceProject } from './mappers';
import type { BackendTask, BackendProject } from './types';

test('maps backend task dates and dependency rows to workspace task shape', () => {
  const task: BackendTask = {
    id: 'task-2',
    displayId: 'T-002',
    projectId: 'project-1',
    parentId: 'task-1',
    title: 'Validate integration',
    description: '',
    status: 'in_progress',
    assigneeId: null,
    plannedStart: '2026-05-08T00:00:00.000Z',
    plannedEnd: new Date('2026-05-10T00:00:00.000Z'),
    actualStart: null,
    actualEnd: null,
    estimatedHours: 8,
    actualHours: 2,
    priority: 'critical',
    progress: 25,
    dependencies: [
      {
        id: 'dep-1',
        sourceTaskId: 'task-1',
        targetTaskId: 'task-2',
        type: 'FS',
        lag: 1,
      },
    ],
  };

  assert.deepEqual(mapBackendTaskToWorkspaceTask(task), {
    id: 'task-2',
    displayId: 'T-002',
    title: 'Validate integration',
    status: 'in_progress',
    priority: 'critical',
    plannedStart: '2026-05-08',
    plannedEnd: '2026-05-10',
    progress: 25,
    parentId: 'task-1',
    dependencies: [{ id: 'dep-1', taskId: 'task-1', type: 'FS', lag: 1 }],
  });
});

test('maps backend project to workspace overview metrics', () => {
  const project: BackendProject = {
    id: 'project-1',
    name: 'TaskPulse Launch',
    description: 'Launch plan',
    startDate: '2026-05-01T00:00:00.000Z',
    endDate: '2026-05-31T00:00:00.000Z',
    status: 'active',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-08T00:00:00.000Z',
  };

  assert.deepEqual(mapBackendProjectToWorkspaceProject(project, []), {
    id: 'project-1',
    name: 'TaskPulse Launch',
    release_status: 'On Track',
    requirement_coverage: 0,
    risk_coverage: 0,
    validation_coverage: 0,
    open_issues: 0,
    pending_reviews: 0,
    pending_approvals: 0,
  });
});
