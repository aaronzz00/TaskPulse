import type {
  BackendProject,
  BackendTask,
  WorkspaceProject,
  WorkspaceTask,
  WorkspaceTaskStatus,
} from './types';

export function toDateInputValue(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return new Date(value).toISOString().slice(0, 10);
}

export function mapBackendTaskToWorkspaceTask(task: BackendTask): WorkspaceTask {
  const dependencies = task.dependencies?.map((dependency) => ({
    id: dependency.id,
    taskId: dependency.sourceTaskId,
    type: dependency.type,
    lag: dependency.lag,
  }));

  return {
    id: task.id,
    ...(task.displayId ? { displayId: task.displayId } : {}),
    title: task.title,
    status: mapWorkspaceTaskStatus(task.status),
    priority: task.priority,
    plannedStart: toDateInputValue(task.plannedStart),
    plannedEnd: toDateInputValue(task.plannedEnd),
    progress: task.progress,
    ...(task.parentId ? { parentId: task.parentId } : {}),
    ...(dependencies?.length ? { dependencies } : {}),
  };
}

export function mapBackendProjectToWorkspaceProject(
  project: BackendProject,
  tasks: WorkspaceTask[],
): WorkspaceProject {
  const openIssues = tasks.filter((task) => task.priority === 'critical' && task.status !== 'done').length;

  return {
    id: project.id,
    name: project.name,
    release_status: project.status === 'completed' ? 'Completed' : project.status === 'archived' ? 'Archived' : 'On Track',
    requirement_coverage: 0,
    risk_coverage: 0,
    validation_coverage: 0,
    open_issues: openIssues,
    pending_reviews: 0,
    pending_approvals: 0,
  };
}

function mapWorkspaceTaskStatus(status: BackendTask['status']): WorkspaceTaskStatus {
  if (status === 'cancelled') {
    return 'todo';
  }

  return status;
}
