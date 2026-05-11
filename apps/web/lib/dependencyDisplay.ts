import type { Task } from '@/types';
import { getTaskDisplayId } from './taskDisplay';
import { normalizeSearchQuery, taskMatchesSearch } from './taskSearch';

export function getTaskPathLabel(task: Pick<Task, 'id' | 'displayId' | 'title' | 'parentId'>, tasks: Pick<Task, 'id' | 'displayId' | 'title' | 'parentId'>[]): string {
  const parentTitles: string[] = [];
  const taskById = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  let parentId = task.parentId;

  while (parentId) {
    const parent = taskById.get(parentId);
    if (!parent) break;
    parentTitles.push(parent.title);
    parentId = parent.parentId;
  }

  return [
    `${getTaskDisplayId(task)} ${task.title}`,
    ...parentTitles,
  ].join(' / ');
}

export function getDependencyCandidateTasks(currentTask: Task, tasks: Task[], query: string): Task[] {
  const existingSourceIds = new Set((currentTask.dependencies || []).map((dependency) => dependency.taskId));
  const normalizedQuery = normalizeSearchQuery(query);

  return tasks.filter((task) => {
    if (task.id === currentTask.id) return false;
    if (existingSourceIds.has(task.id)) return false;
    if (!normalizedQuery) return true;

    return taskMatchesSearch(task, normalizedQuery);
  });
}
