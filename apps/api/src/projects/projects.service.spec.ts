import assert from 'node:assert/strict';
import test from 'node:test';
import { ProjectsService } from './projects.service';

test('archive marks the project archived without deleting data', async () => {
  const updates: unknown[] = [];
  const prisma = {
    project: {
      update: async (args: unknown) => {
        updates.push(args);
        return { id: 'project-1', status: 'archived' };
      },
    },
  };
  const service = new ProjectsService(prisma as any);

  const result = await service.archive('project-1');

  assert.equal(result.status, 'archived');
  assert.deepEqual(updates, [{ where: { id: 'project-1' }, data: { status: 'archived' } }]);
});

test('duplicate copies project tasks and dependencies in a transaction', async () => {
  const calls: string[] = [];
  const createdTasks: Array<{ id: string; oldTitle: string }> = [];
  const createdDependencies: unknown[] = [];
  const prisma = {
    $transaction: async (fn: any) => fn(prisma),
    project: {
      findUnique: async (args: any) => {
        if (args.where.id === 'copy-project') {
          return { id: 'copy-project', name: 'Copy', tasks: [], insights: [] };
        }

        return {
          id: 'source-project',
          name: 'Source',
          description: 'Original',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-01-31T00:00:00.000Z'),
          status: 'active',
          tasks: [
            {
              id: 'task-a',
              parentId: null,
              title: 'A',
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
            },
            {
              id: 'task-b',
              parentId: 'task-a',
              title: 'B',
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
            },
          ],
          dependencies: [
            {
              sourceTaskId: 'task-a',
              targetTaskId: 'task-b',
              type: 'FS',
              lag: 0,
              source: 'manual',
            },
          ],
        };
      },
      create: async () => {
        calls.push('project.create');
        return { id: 'copy-project' };
      },
    },
    task: {
      create: async (args: any) => {
        calls.push('task.create');
        const id = `copy-task-${createdTasks.length + 1}`;
        createdTasks.push({ id, oldTitle: args.data.title });
        return { id };
      },
    },
    dependency: {
      create: async (args: unknown) => {
        calls.push('dependency.create');
        createdDependencies.push(args);
        return {};
      },
    },
  };
  const service = new ProjectsService(prisma as any);

  await service.duplicate('source-project', { name: 'Copy' });

  assert.deepEqual(calls, ['project.create', 'task.create', 'task.create', 'dependency.create']);
  assert.equal(createdTasks[1].oldTitle, 'B');
  assert.deepEqual(createdDependencies, [
    {
      data: {
        sourceTaskId: 'copy-task-1',
        targetTaskId: 'copy-task-2',
        type: 'FS',
        lag: 0,
        source: 'manual',
      },
    },
  ]);
});

test('importParsedScheduleRows creates a project with tasks, hierarchy, and dependencies', async () => {
  const createdTasks: any[] = [];
  const createdDependencies: any[] = [];
  const prisma = {
    $transaction: async (fn: any) => fn(prisma),
    project: {
      create: async (args: any) => ({
        id: 'imported-project',
        ...args.data,
      }),
      findUnique: async () => ({
        id: 'imported-project',
        name: 'Imported Plan',
        tasks: createdTasks,
        insights: [],
      }),
    },
    task: {
      create: async (args: any) => {
        const task = { id: `task-${createdTasks.length + 1}`, ...args.data };
        createdTasks.push(task);
        return task;
      },
    },
    dependency: {
      create: async (args: any) => {
        createdDependencies.push(args);
        return args.data;
      },
    },
  };
  const service = new ProjectsService(prisma as any);

  await service.importParsedScheduleRows('Imported Plan', [
    {
      id: 'row-a',
      rowNumber: 1,
      title: 'Phase',
      indent: 0,
      startIso: '2026-01-01T00:00:00.000Z',
      endIso: '2026-01-05T00:00:00.000Z',
      predecessorText: '',
      predecessors: [],
      parentId: null,
    },
    {
      id: 'row-b',
      rowNumber: 2,
      title: 'Build',
      indent: 1,
      startIso: '2026-01-06T00:00:00.000Z',
      endIso: '2026-01-08T00:00:00.000Z',
      predecessorText: '1FS',
      predecessors: [{ sourceRowNumber: 1, type: 'FS', lag: 0 }],
      parentId: 'row-a',
    },
  ]);

  assert.equal(createdTasks.length, 2);
  assert.equal(createdTasks[0].displayId, 'W-001');
  assert.equal(createdTasks[1].displayId, 'W-002');
  assert.equal(createdTasks[1].parentId, 'task-1');
  assert.deepEqual(createdDependencies, [
    {
      data: {
        sourceTaskId: 'task-1',
        targetTaskId: 'task-2',
        type: 'FS',
        lag: 0,
        source: 'imported',
      },
    },
  ]);
});
