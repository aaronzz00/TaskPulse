import type { Task, TaskDependency } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

interface Edge {
  id?: string;
  sourceTaskId: string;
  targetTaskId: string;
  type: TaskDependency['type'];
  lag: number;
}

export interface CriticalPathResult {
  criticalTaskIds: string[];
  criticalDependencyIds: string[];
  slackByTaskId: Record<string, number>;
  hasCycle: boolean;
}

export function calculateCriticalPath(tasks: Task[]): CriticalPathResult {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const edges = tasks.flatMap((task) => (task.dependencies || []).map((dependency) => ({
    id: dependency.id,
    sourceTaskId: dependency.taskId,
    targetTaskId: task.id,
    type: dependency.type,
    lag: dependency.lag,
  }))).filter((edge) => taskById.has(edge.sourceTaskId));

  const orderedTaskIds = topologicalSort(tasks.map((task) => task.id), edges);
  if (!orderedTaskIds) {
    return {
      criticalTaskIds: [],
      criticalDependencyIds: [],
      slackByTaskId: {},
      hasCycle: true,
    };
  }

  const durationByTaskId = new Map(tasks.map((task) => [task.id, getDurationDays(task)]));
  const earliestStart = new Map<string, number>();
  const earliestFinish = new Map<string, number>();

  for (const taskId of orderedTaskIds) {
    earliestStart.set(taskId, earliestStart.get(taskId) ?? 0);
    earliestFinish.set(taskId, (earliestStart.get(taskId) ?? 0) + (durationByTaskId.get(taskId) ?? 1));

    for (const edge of edges.filter((candidate) => candidate.sourceTaskId === taskId)) {
      const nextStart = getConstrainedTargetStart(edge, earliestStart, durationByTaskId);
      if (nextStart > (earliestStart.get(edge.targetTaskId) ?? 0)) {
        earliestStart.set(edge.targetTaskId, nextStart);
        earliestFinish.set(edge.targetTaskId, nextStart + (durationByTaskId.get(edge.targetTaskId) ?? 1));
      }
    }
  }

  const projectDuration = Math.max(...orderedTaskIds.map((taskId) => earliestFinish.get(taskId) ?? 0), 0);
  const latestStart = new Map<string, number>();
  const latestFinish = new Map<string, number>();

  for (const taskId of [...orderedTaskIds].reverse()) {
    const duration = durationByTaskId.get(taskId) ?? 1;
    if (!latestFinish.has(taskId)) {
      latestFinish.set(taskId, projectDuration);
      latestStart.set(taskId, projectDuration - duration);
    }

    for (const edge of edges.filter((candidate) => candidate.targetTaskId === taskId)) {
      const sourceLatestStart = getConstrainedSourceLatestStart(edge, latestStart, latestFinish, durationByTaskId);
      if (!latestStart.has(edge.sourceTaskId) || sourceLatestStart < (latestStart.get(edge.sourceTaskId) ?? Infinity)) {
        latestStart.set(edge.sourceTaskId, sourceLatestStart);
        latestFinish.set(edge.sourceTaskId, sourceLatestStart + (durationByTaskId.get(edge.sourceTaskId) ?? 1));
      }
    }
  }

  const slackByTaskId: Record<string, number> = {};
  for (const taskId of orderedTaskIds) {
    slackByTaskId[taskId] = Math.max(0, Math.round((latestStart.get(taskId) ?? 0) - (earliestStart.get(taskId) ?? 0)));
  }

  const criticalTaskIds = orderedTaskIds.filter((taskId) => slackByTaskId[taskId] === 0);
  const criticalTaskSet = new Set(criticalTaskIds);
  const criticalDependencyIds = edges
    .filter((edge) => {
      if (!edge.id || !criticalTaskSet.has(edge.sourceTaskId) || !criticalTaskSet.has(edge.targetTaskId)) return false;
      return isEdgeTight(edge, earliestStart, earliestFinish, durationByTaskId);
    })
    .map((edge) => edge.id as string);

  return {
    criticalTaskIds,
    criticalDependencyIds,
    slackByTaskId,
    hasCycle: false,
  };
}

function topologicalSort(taskIds: string[], edges: Edge[]): string[] | null {
  const inDegree = new Map(taskIds.map((taskId) => [taskId, 0]));
  const successors = new Map(taskIds.map((taskId) => [taskId, [] as string[]]));

  for (const edge of edges) {
    inDegree.set(edge.targetTaskId, (inDegree.get(edge.targetTaskId) ?? 0) + 1);
    successors.get(edge.sourceTaskId)?.push(edge.targetTaskId);
  }

  const queue = taskIds.filter((taskId) => (inDegree.get(taskId) ?? 0) === 0);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const taskId = queue.shift() as string;
    ordered.push(taskId);

    for (const successorId of successors.get(taskId) || []) {
      inDegree.set(successorId, (inDegree.get(successorId) ?? 0) - 1);
      if ((inDegree.get(successorId) ?? 0) === 0) {
        queue.push(successorId);
      }
    }
  }

  return ordered.length === taskIds.length ? ordered : null;
}

function getDurationDays(task: Pick<Task, 'plannedStart' | 'plannedEnd'>): number {
  const start = parseDateOnlyUtc(task.plannedStart).getTime();
  const end = parseDateOnlyUtc(task.plannedEnd).getTime();
  return Math.max(1, Math.round((end - start) / DAY_MS) + 1);
}

function getConstrainedTargetStart(edge: Edge, earliestStart: Map<string, number>, durationByTaskId: Map<string, number>): number {
  const sourceStart = earliestStart.get(edge.sourceTaskId) ?? 0;
  const sourceDuration = durationByTaskId.get(edge.sourceTaskId) ?? 1;
  const targetDuration = durationByTaskId.get(edge.targetTaskId) ?? 1;

  if (edge.type === 'SS') return sourceStart + edge.lag;
  if (edge.type === 'FF') return sourceStart + sourceDuration + edge.lag - targetDuration;
  if (edge.type === 'SF') return sourceStart + edge.lag - targetDuration;
  return sourceStart + sourceDuration + edge.lag;
}

function getConstrainedSourceLatestStart(
  edge: Edge,
  latestStart: Map<string, number>,
  latestFinish: Map<string, number>,
  durationByTaskId: Map<string, number>,
): number {
  const targetStart = latestStart.get(edge.targetTaskId) ?? 0;
  const targetFinish = latestFinish.get(edge.targetTaskId) ?? targetStart + (durationByTaskId.get(edge.targetTaskId) ?? 1);
  const sourceDuration = durationByTaskId.get(edge.sourceTaskId) ?? 1;

  if (edge.type === 'SS') return targetStart - edge.lag;
  if (edge.type === 'FF') return targetFinish - sourceDuration - edge.lag;
  if (edge.type === 'SF') return targetFinish - edge.lag;
  return targetStart - sourceDuration - edge.lag;
}

function isEdgeTight(
  edge: Edge,
  earliestStart: Map<string, number>,
  earliestFinish: Map<string, number>,
  durationByTaskId: Map<string, number>,
): boolean {
  const targetStart = earliestStart.get(edge.targetTaskId) ?? 0;
  const targetFinish = earliestFinish.get(edge.targetTaskId) ?? targetStart + (durationByTaskId.get(edge.targetTaskId) ?? 1);
  const sourceStart = earliestStart.get(edge.sourceTaskId) ?? 0;
  const sourceFinish = earliestFinish.get(edge.sourceTaskId) ?? sourceStart + (durationByTaskId.get(edge.sourceTaskId) ?? 1);

  if (edge.type === 'SS') return targetStart === sourceStart + edge.lag;
  if (edge.type === 'FF') return targetFinish === sourceFinish + edge.lag;
  if (edge.type === 'SF') return targetFinish === sourceStart + edge.lag;
  return targetStart === sourceFinish + edge.lag;
}

function parseDateOnlyUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
