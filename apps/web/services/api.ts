import {
  mapBackendProjectToWorkspaceProject,
  mapBackendTaskToWorkspaceTask,
  type BackendProject,
  type BackendDependency,
  type BackendTask,
  type DependencyType,
  type WorkspaceProject,
  type WorkspaceTask,
} from '@taskpulse/contracts';

export type TaskUpdatePayload = Partial<Omit<WorkspaceTask, 'dependencies'>>;
type CreateDependencyPayload = {
  sourceTaskId: string;
  targetTaskId: string;
  type?: DependencyType;
  lag?: number;
};
type UpdateDependencyPayload = Partial<Pick<BackendDependency, 'sourceTaskId' | 'targetTaskId' | 'type' | 'lag' | 'source'>>;
type CreateProjectPayload = {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: BackendProject['status'];
};
type DuplicateProjectPayload = {
  name?: string;
  copyBaseline?: boolean;
};
export type ScheduleVersion = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  type: 'manual' | 'baseline' | 'imported' | 'auto' | 'rollback';
  taskCount: number;
  dependencyCount: number;
  isBaseline: boolean;
  createdAt: string;
};
type CreateScheduleVersionPayload = {
  name: string;
  description?: string;
  type?: ScheduleVersion['type'];
  isBaseline?: boolean;
};
export type AIProviderConfig = {
  id: string;
  name: string;
  provider: 'openai-compatible' | 'anthropic';
  baseUrl?: string | null;
  model: string;
  apiKeyPreview: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};
type CreateAIProviderPayload = {
  name: string;
  provider: AIProviderConfig['provider'];
  baseUrl?: string;
  model: string;
  apiKey: string;
  enabled?: boolean;
  isDefault?: boolean;
};
type ChatPayload = {
  projectId: string;
  message: string;
  providerConfigId?: string;
};
export type ChatResponse = {
  response: string;
  provider: string;
  model: string;
  projectId: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = {
  fetchProjects: async (): Promise<BackendProject[]> => {
    return request<BackendProject[]>('/projects');
  },

  fetchProjectOverview: async (projectId: string, tasks: WorkspaceTask[]): Promise<WorkspaceProject> => {
    const project = await request<BackendProject>(`/projects/${projectId}`);
    return mapBackendProjectToWorkspaceProject(project, tasks);
  },

  createProject: async (project: CreateProjectPayload): Promise<BackendProject> => {
    const today = new Date().toISOString().slice(0, 10);
    return request<BackendProject>('/projects', {
      method: 'POST',
      body: JSON.stringify({
        description: '',
        startDate: today,
        endDate: today,
        status: 'draft',
        ...project,
      }),
    });
  },

  duplicateProject: async (projectId: string, payload: DuplicateProjectPayload = {}): Promise<BackendProject> => {
    return request<BackendProject>(`/projects/${encodeURIComponent(projectId)}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  importProjectFromExcel: async (file: File, name?: string): Promise<BackendProject> => {
    const formData = new FormData();
    formData.append('file', file);
    if (name?.trim()) {
      formData.append('name', name.trim());
    }

    const response = await fetch(`${API_BASE_URL}/projects/import`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(message || `TaskPulse API request failed with ${response.status}`);
    }

    return response.json() as Promise<BackendProject>;
  },

  archiveProject: async (projectId: string): Promise<BackendProject> => {
    return request<BackendProject>(`/projects/${encodeURIComponent(projectId)}/archive`, {
      method: 'POST',
    });
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

  updateTask: async (id: string, updates: TaskUpdatePayload): Promise<WorkspaceTask> => {
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

  createDependency: async (dependency: CreateDependencyPayload): Promise<BackendDependency> => {
    return request<BackendDependency>('/dependencies', {
      method: 'POST',
      body: JSON.stringify({
        type: 'FS',
        lag: 0,
        source: 'manual',
        ...dependency,
      }),
    });
  },

  updateDependency: async (id: string, updates: UpdateDependencyPayload): Promise<BackendDependency> => {
    return request<BackendDependency>(`/dependencies/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  deleteDependency: async (id: string): Promise<boolean> => {
    await request(`/dependencies/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    return true;
  },

  createScheduleVersion: async (
    projectId: string,
    payload: CreateScheduleVersionPayload,
  ): Promise<ScheduleVersion> => {
    return request<ScheduleVersion>(`/projects/${encodeURIComponent(projectId)}/schedule-versions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  fetchScheduleVersions: async (projectId: string): Promise<ScheduleVersion[]> => {
    return request<ScheduleVersion[]>(`/projects/${encodeURIComponent(projectId)}/schedule-versions`);
  },

  restoreScheduleVersion: async (projectId: string, versionId: string): Promise<BackendProject> => {
    return request<BackendProject>(
      `/projects/${encodeURIComponent(projectId)}/schedule-versions/${encodeURIComponent(versionId)}/restore`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
  },

  fetchAIProviders: async (): Promise<AIProviderConfig[]> => {
    return request<AIProviderConfig[]>('/ai/providers');
  },

  createAIProvider: async (payload: CreateAIProviderPayload): Promise<AIProviderConfig> => {
    return request<AIProviderConfig>('/ai/providers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  testAIProvider: async (id: string): Promise<{ ok: boolean; message?: string }> => {
    return request<{ ok: boolean; message?: string }>(`/ai/providers/${encodeURIComponent(id)}/test`, {
      method: 'POST',
    });
  },

  setDefaultAIProvider: async (id: string): Promise<AIProviderConfig> => {
    return request<AIProviderConfig>(`/ai/providers/${encodeURIComponent(id)}/default`, {
      method: 'POST',
    });
  },

  chat: async (payload: ChatPayload): Promise<ChatResponse> => {
    return request<ChatResponse>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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

function toUpdateTaskPayload(updates: TaskUpdatePayload): TaskUpdatePayload {
  return updates;
}
