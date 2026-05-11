import assert from 'node:assert/strict';
import test from 'node:test';
import { TasksService } from './tasks.service';

test('batchUpdate applies multiple task updates in one transaction', async () => {
  const updates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
  const prisma = {
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    task: {
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push(args);
        return Promise.resolve({ id: args.where.id, ...args.data });
      },
    },
  };
  const service = new TasksService(prisma as any, {} as any);

  const result = await (service as any).batchUpdate({
    tasks: [
      { id: 'task-1', progress: 30, plannedStart: '2026-05-08', plannedEnd: '2026-05-10' },
      { id: 'task-2', progress: 60, plannedStart: '2026-05-11', plannedEnd: '2026-05-12' },
    ],
  });

  assert.equal(result.length, 2);
  assert.deepEqual(
    updates.map((update) => update.where.id),
    ['task-1', 'task-2'],
  );
  assert.ok(updates[0].data.plannedStart instanceof Date);
  assert.ok(updates[0].data.plannedEnd instanceof Date);
  assert.equal(updates[1].data.progress, 60);
});

test('create assigns the next project-scoped display id when omitted', async () => {
  const createCalls: any[] = [];
  const prisma = {
    project: {
      findUnique: async () => ({ id: 'project-1' }),
    },
    task: {
      findUnique: async () => null,
      findMany: async () => [{ displayId: 'T-001' }, { displayId: 'T-003' }],
      create: async (args: any) => {
        createCalls.push(args);
        return { id: 'task-new', ...args.data };
      },
    },
  };
  const service = new TasksService(prisma as any, {} as any);

  const task = await service.create({
    projectId: 'project-1',
    title: 'New task',
    description: '',
    plannedStart: '2026-05-01',
    plannedEnd: '2026-05-02',
  } as any);

  assert.equal((task as any).displayId, 'T-004');
  assert.equal(createCalls[0].data.displayId, 'T-004');
});

test('create preserves an explicit display id', async () => {
  const prisma = {
    project: {
      findUnique: async () => ({ id: 'project-1' }),
    },
    task: {
      findUnique: async () => null,
      findMany: async () => {
        throw new Error('should not generate a display id');
      },
      create: async (args: any) => ({ id: 'task-new', ...args.data }),
    },
  };
  const service = new TasksService(prisma as any, {} as any);

  const task = await service.create({
    projectId: 'project-1',
    displayId: 'W-001',
    title: 'Imported task',
    description: '',
    plannedStart: '2026-05-01',
    plannedEnd: '2026-05-02',
  } as any);

  assert.equal((task as any).displayId, 'W-001');
});

test('findAll returns dependencies as predecessors for each task', async () => {
  const prisma = {
    task: {
      findMany: async () => [
        {
          id: 'task-1',
          title: 'Predecessor',
          dependents: [],
          children: [],
        },
        {
          id: 'task-2',
          title: 'Successor',
          dependents: [
            {
              id: 'dep-1',
              sourceTaskId: 'task-1',
              targetTaskId: 'task-2',
              type: 'SS',
              lag: 5,
            },
          ],
          children: [],
        },
      ],
    },
  };
  const service = new TasksService(prisma as any, {} as any);

  const tasks = await service.findAll('project-1');

  assert.deepEqual((tasks as any)[1].dependencies, [
    {
      id: 'dep-1',
      sourceTaskId: 'task-1',
      targetTaskId: 'task-2',
      type: 'SS',
      lag: 5,
    },
  ]);
  assert.equal('dependents' in (tasks as any)[1], false);
});
