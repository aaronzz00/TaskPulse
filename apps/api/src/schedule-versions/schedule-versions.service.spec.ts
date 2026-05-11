import assert from 'node:assert/strict';
import test from 'node:test';
import { ScheduleVersionsService } from './schedule-versions.service';

const projectFixture = {
  id: 'project-1',
  name: 'Project',
  description: 'Schedule',
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2026-01-31T00:00:00.000Z'),
  status: 'active',
  tasks: [
    {
      id: 'task-1',
      displayId: 'T-001',
      parentId: null,
      title: 'Task 1',
      description: '',
      status: 'todo',
      assigneeId: null,
      plannedStart: new Date('2026-01-01T00:00:00.000Z'),
      plannedEnd: new Date('2026-01-02T00:00:00.000Z'),
      actualStart: null,
      actualEnd: null,
      estimatedHours: 0,
      actualHours: 0,
      priority: 'medium',
      progress: 0,
      aiConfidence: null,
      aiReasoning: null,
      dependents: [
        {
          id: 'dep-1',
          sourceTaskId: 'task-1',
          targetTaskId: 'task-2',
          type: 'FS',
          lag: 0,
          source: 'manual',
        },
      ],
    },
    {
      id: 'task-2',
      displayId: 'T-002',
      parentId: 'task-1',
      title: 'Task 2',
      description: '',
      status: 'todo',
      assigneeId: null,
      plannedStart: new Date('2026-01-03T00:00:00.000Z'),
      plannedEnd: new Date('2026-01-04T00:00:00.000Z'),
      actualStart: null,
      actualEnd: null,
      estimatedHours: 0,
      actualHours: 0,
      priority: 'medium',
      progress: 0,
      aiConfidence: null,
      aiReasoning: null,
      dependents: [],
    },
  ],
};

test('createSnapshot stores a normalized schedule snapshot and clears previous baselines', async () => {
  const calls: Array<{ method: string; args: any }> = [];
  const prisma = {
    $transaction: async (fn: any) => fn(prisma),
    project: {
      findUnique: async () => projectFixture,
    },
    scheduleVersion: {
      updateMany: async (args: any) => {
        calls.push({ method: 'updateMany', args });
        return { count: 1 };
      },
      create: async (args: any) => {
        calls.push({ method: 'create', args });
        return { id: 'version-1', ...args.data };
      },
    },
  };
  const service = new ScheduleVersionsService(prisma as any);

  const version = await service.createSnapshot('project-1', {
    name: 'Baseline',
    type: 'baseline',
    isBaseline: true,
  });

  assert.equal(version.taskCount, 2);
  assert.equal(version.dependencyCount, 1);
  assert.equal(version.snapshotJson.tasks[0].displayId, 'T-001');
  assert.equal(version.snapshotJson.tasks[0].plannedStart, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(calls[0], {
    method: 'updateMany',
    args: { where: { projectId: 'project-1', isBaseline: true }, data: { isBaseline: false } },
  });
});

test('restore creates rollback snapshot before replacing tasks and dependencies', async () => {
  const calls: string[] = [];
  const version = {
    id: 'version-1',
    projectId: 'project-1',
    snapshotJson: {
      project: {
        name: 'Restored',
        description: 'Snapshot',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-31T00:00:00.000Z',
        status: 'active',
      },
      tasks: [
        {
          id: 'task-1',
          displayId: 'T-001',
          parentId: null,
          title: 'Task 1',
          description: '',
          status: 'todo',
          assigneeId: null,
          plannedStart: '2026-01-01T00:00:00.000Z',
          plannedEnd: '2026-01-02T00:00:00.000Z',
          actualStart: null,
          actualEnd: null,
          estimatedHours: 0,
          actualHours: 0,
          priority: 'medium',
          progress: 0,
          aiConfidence: null,
          aiReasoning: null,
        },
      ],
      dependencies: [
        {
          sourceTaskId: 'task-1',
          targetTaskId: 'task-1',
          type: 'FS',
          lag: 0,
          source: 'manual',
        },
      ],
    },
  };
  const prisma = {
    $transaction: async (fn: any) => fn(prisma),
    project: {
      findUnique: async () => projectFixture,
      update: async () => {
        calls.push('project.update');
        return { id: 'project-1' };
      },
    },
    scheduleVersion: {
      findUnique: async () => version,
      create: async (args: any) => {
        calls.push(`scheduleVersion.create:${args.data.type}`);
        return { id: 'rollback-1', ...args.data };
      },
    },
    dependency: {
      deleteMany: async () => {
        calls.push('dependency.deleteMany');
      },
      create: async () => {
        calls.push('dependency.create');
      },
    },
    task: {
      deleteMany: async () => {
        calls.push('task.deleteMany');
      },
      create: async (args: any) => {
        assert.equal(args.data.displayId, 'T-001');
        calls.push('task.create');
      },
    },
  };
  const service = new ScheduleVersionsService(prisma as any);

  await service.restore('project-1', 'version-1');

  assert.deepEqual(calls, [
    'scheduleVersion.create:rollback',
    'dependency.deleteMany',
    'task.deleteMany',
    'task.create',
    'dependency.create',
    'project.update',
  ]);
});
