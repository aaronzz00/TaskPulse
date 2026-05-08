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
