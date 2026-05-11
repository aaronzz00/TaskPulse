import type { Task } from '@/types';
import { getTaskDisplayId } from './taskDisplay';

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function taskMatchesSearch(task: Pick<Task, 'id' | 'displayId' | 'title' | 'status' | 'plannedStart' | 'plannedEnd'>, query: string): boolean {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return false;

  const haystack = [
    task.id,
    task.displayId,
    getTaskDisplayId(task),
    task.title,
    task.status.replace(/_/g, ' '),
    task.plannedStart,
    task.plannedEnd,
  ].join(' ').toLowerCase().replace(/[_-]+/g, ' ');

  return haystack.includes(normalizedQuery);
}

export function getSearchResults(tasks: Task[], query: string): string[] {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return [];

  return tasks
    .filter((task) => taskMatchesSearch(task, normalizedQuery))
    .map((task) => task.id);
}

export function buildSearchExpansion(tasks: Pick<Task, 'id' | 'parentId'>[], resultTaskIds: string[]): Set<string> {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const expanded = new Set<string>();

  for (const taskId of resultTaskIds) {
    const ancestors: string[] = [];
    let parentId = taskById.get(taskId)?.parentId;
    while (parentId) {
      ancestors.unshift(parentId);
      parentId = taskById.get(parentId)?.parentId;
    }
    ancestors.forEach((ancestorId) => expanded.add(ancestorId));
  }

  return expanded;
}

export function advanceSearchResult(currentIndex: number, resultCount: number): number {
  if (resultCount <= 0) return -1;
  return (currentIndex + 1) % resultCount;
}
