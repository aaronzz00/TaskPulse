import {
  mapBackendProjectToWorkspaceProject,
  mapBackendTaskToWorkspaceTask,
  type BackendProject,
  type BackendTask,
  type WorkspaceProject,
  type WorkspaceTask,
} from '@taskpulse/contracts';

type TaskUpdatePayload = Partial<Omit<WorkspaceTask, 'dependencies'>>;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = {
  fetchProjects: async (): Promise<BackendProject[]> => {
    return request<BackendProject[]>('/projects');
  },

  fetchProjectOverview: async (projectId: string, tasks: WorkspaceTask[]): Promise<WorkspaceProject> => {
    const project = await request<BackendProject>(`/projects/${projectId}`);
    return mapBackendProjectToWorkspaceProject(project, tasks);
  },

  fetchTasks: async (projectId: string): Promise<WorkspaceTask[]> => {
    const tasks = await request<BackendTask[]>(`/tasks?projectId=${encodeURIComponent(projectId)}`);
    return tasks.map(mapBackendTaskToWorkspaceTask);
  },

  createTask: async (task: Omit<WorkspaceTask, 'id'>, projectId: string): Promise<WorkspaceTask> => {
    const created = await request<BackendTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify(toCreateTaskPayload(task, projectId)),
    });

    return mapBackendTaskToWorkspaceTask(created);
  },

  updateTask: async (id: string, updates: Partial<WorkspaceTask>): Promise<WorkspaceTask> => {
    const updated = await request<BackendTask>(`/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(toUpdateTaskPayload(updates)),
    });

    return mapBackendTaskToWorkspaceTask(updated);
  },

  batchUpdateTasks: async (updates: Array<TaskUpdatePayload & { id: string }>): Promise<WorkspaceTask[]> => {
    const updated = await request<BackendTask[]>('/tasks/batch', {
      method: 'PATCH',
      body: JSON.stringify({
        tasks: updates.map(({ id, ...taskUpdates }) => ({
          id,
          ...toUpdateTaskPayload(taskUpdates),
        })),
      }),
    });

    return updated.map(mapBackendTaskToWorkspaceTask);
  },

  deleteTask: async (id: string): Promise<boolean> => {
    await request(`/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    return true;
  },
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(message || `TaskPulse API request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function toCreateTaskPayload(task: Omit<WorkspaceTask, 'id'>, projectId: string) {
  return {
    projectId,
    parentId: task.parentId,
    title: task.title,
    description: '',
    status: task.status,
    priority: task.priority,
    plannedStart: task.plannedStart,
    plannedEnd: task.plannedEnd,
    progress: task.progress,
  };
}

function toUpdateTaskPayload(updates: Partial<WorkspaceTask>): TaskUpdatePayload {
  const { dependencies: _dependencies, ...taskUpdates } = updates;
  return taskUpdates;
}
