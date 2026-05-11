import { create } from 'zustand';
import type { BackendProject } from '@taskpulse/contracts';
import type { DependencyType, Task, Project } from '@/types';
import { api } from '@/services/api';
import { advanceSearchResult as nextSearchResultIndex, getSearchResults } from '@/lib/taskSearch';

type TaskEditableUpdates = Partial<Omit<Task, 'dependencies' | 'parentId'>> & { parentId?: string | null };
export type DependencyViewMode = 'selected' | 'critical' | 'all' | 'off';
export type AIMessage = { role: 'user' | 'ai'; text: string; provider?: string; model?: string };

const CURRENT_PROJECT_STORAGE_KEY = 'taskpulseCurrentProjectId';

interface AppState {
  tasks: Task[];
  project: Project | null;
  isLoading: boolean;
  error: string | null;
  currentProjectId: string | null;
  isAiSidebarOpen: boolean;
  viewMode: 'day' | 'week' | 'month';
  selectedTaskId: string | null;
  searchQuery: string;
  activeSearchResultIndex: number;
  dependencyViewMode: DependencyViewMode;
  projects: BackendProject[];
  aiMessages: AIMessage[];
  
  // Actions
  fetchData: () => Promise<void>;
  switchProject: (projectId: string) => Promise<void>;
  createBlankProject: (name: string) => Promise<void>;
  duplicateCurrentProject: (name?: string) => Promise<void>;
  importProjectFromExcel: (file: File, name?: string) => Promise<void>;
  archiveCurrentProject: () => Promise<void>;
  reloadCurrentProject: () => Promise<void>;
  sendAIMessage: (message: string) => Promise<void>;
  createTask: (task: Omit<Task, 'id'>) => Promise<void>;
  updateTaskProgress: (id: string, progress: number) => Promise<void>;
  updateTask: (id: string, updates: TaskEditableUpdates) => Promise<void>;
  createDependency: (sourceTaskId: string, targetTaskId: string, type?: DependencyType, lag?: number) => Promise<void>;
  updateDependency: (targetTaskId: string, dependencyId: string, updates: { type?: DependencyType; lag?: number }) => Promise<void>;
  deleteDependency: (targetTaskId: string, dependencyId: string) => Promise<void>;
  moveTask: (draggedId: string, targetId: string, position: 'before' | 'after' | 'inside') => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  
  toggleAiSidebar: () => void;
  setViewMode: (mode: 'day' | 'week' | 'month') => void;
  setSelectedTask: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  advanceSearchResult: () => void;
  setDependencyViewMode: (mode: DependencyViewMode) => void;
  clearError: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  tasks: [],
  project: null,
  isLoading: false,
  error: null,
  currentProjectId: null,
  isAiSidebarOpen: true,
  viewMode: 'day',
  selectedTaskId: null,
  searchQuery: '',
  activeSearchResultIndex: -1,
  dependencyViewMode: 'selected',
  projects: [],
  aiMessages: [],
  
  fetchData: async () => {
    const { currentProjectId } = get();

    set({ isLoading: true, error: null });
    try {
      const projects = await api.fetchProjects();
      const persistedProjectId = currentProjectId ?? readCurrentProjectId();
      const selectedProject = projects.find(project => project.id === persistedProjectId) ?? projects[0];

      if (!selectedProject) {
        writeCurrentProjectId(null);
        set({ tasks: [], project: null, projects: [], currentProjectId: null, isLoading: false });
        return;
      }

      const tasks = await api.fetchTasks(selectedProject.id);
      const project = await api.fetchProjectOverview(selectedProject.id, tasks);
      writeCurrentProjectId(selectedProject.id);
      set({ tasks, project, projects, currentProjectId: selectedProject.id, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch data', isLoading: false });
    }
  },

  switchProject: async (projectId) => {
    writeCurrentProjectId(projectId);
    set(resetProjectScopedState({ currentProjectId: projectId, error: null }));
    await get().fetchData();
  },

  createBlankProject: async (name) => {
    try {
      const project = await api.createProject({ name });
      await get().switchProject(project.id);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create project' });
    }
  },

  duplicateCurrentProject: async (name) => {
    const { currentProjectId, project } = get();
    if (!currentProjectId) return;

    try {
      const copiedProject = await api.duplicateProject(currentProjectId, {
        name: name?.trim() || `${project?.name ?? 'Project'} Copy`,
      });
      await get().switchProject(copiedProject.id);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to duplicate project' });
    }
  },

  importProjectFromExcel: async (file, name) => {
    try {
      const importedProject = await api.importProjectFromExcel(file, name);
      await get().switchProject(importedProject.id);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to import project from Excel' });
    }
  },

  archiveCurrentProject: async () => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;

    try {
      await api.archiveProject(currentProjectId);
      writeCurrentProjectId(null);
      set(resetProjectScopedState({ currentProjectId: null, error: null }));
      await get().fetchData();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to archive project' });
    }
  },

  reloadCurrentProject: async () => {
    set(resetProjectScopedState({ error: null }));
    await get().fetchData();
  },

  sendAIMessage: async (message) => {
    const trimmed = message.trim();
    const { currentProjectId, aiMessages } = get();
    if (!trimmed || !currentProjectId) return;

    set({
      aiMessages: [...aiMessages, { role: 'user', text: trimmed }],
      error: null,
    });

    try {
      const response = await api.chat({ projectId: currentProjectId, message: trimmed });
      set({
        aiMessages: [
          ...get().aiMessages,
          {
            role: 'ai',
            text: response.response,
            provider: response.provider,
            model: response.model,
          },
        ],
      });
    } catch (err) {
      set({
        aiMessages: [
          ...get().aiMessages,
          { role: 'ai', text: err instanceof Error ? err.message : 'AI request failed' },
        ],
        error: err instanceof Error ? err.message : 'AI request failed',
      });
    }
  },

  createTask: async (taskData) => {
    const { currentProjectId, tasks } = get();
    if (!currentProjectId) return;

    try {
      const newTask = await api.createTask(taskData, currentProjectId);
      set({ tasks: [...tasks, newTask] });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create task' });
    }
  },

  updateTaskProgress: async (id, progress) => {
    const { tasks } = get();
    // Optimistic update
    set({ tasks: tasks.map(t => t.id === id ? { ...t, progress } : t) });
    
    try {
      await api.updateTask(id, { progress });
    } catch (err) {
      set({ tasks, error: err instanceof Error ? err.message : 'Failed to update progress' });
    }
  },

  moveTask: async (draggedId, targetId, position) => {
    const { tasks } = get();
    const dragged = tasks.find(t => t.id === draggedId);
    const target = tasks.find(t => t.id === targetId);
    if (!dragged || !target || dragged.id === target.id) return;

    const previousOrder = tasks.map(task => task.id);
    const previousDraggedParentId = dragged.parentId;
    let nextParentId: string | undefined;
    let newTasks = [...tasks];
    
    // Remove dragged task from array
    const draggedIndex = newTasks.findIndex(t => t.id === draggedId);
    newTasks.splice(draggedIndex, 1);

    if (position === 'inside') {
      nextParentId = targetId;
      newTasks.push({ ...dragged, parentId: nextParentId }); // We'll just push to end, filter maintains order
    } else {
      nextParentId = target.parentId;
      const targetIndex = newTasks.findIndex(t => t.id === targetId);
      const insertAt = position === 'before' ? targetIndex : targetIndex + 1;
      newTasks.splice(insertAt, 0, { ...dragged, parentId: nextParentId });
    }

    set({ tasks: newTasks, error: null });

    try {
      await api.updateTask(draggedId, toApiTaskUpdates({ parentId: nextParentId ?? null }));
    } catch (err) {
      set({
        tasks: rollbackMovedTask(get().tasks, previousOrder, draggedId, previousDraggedParentId),
        error: err instanceof Error ? err.message : 'Failed to move task',
      });
    }
  },

  updateTask: async (id, updates) => {
    const { tasks } = get();
    const stateUpdates = normalizeTaskUpdatesForState(updates);

    const updatedTasks = applyAutoSchedule(tasks.map(t => t.id === id ? { ...t, ...stateUpdates } : t), [id]);
    const scheduleChangedTaskIds = getScheduleChangedTaskIds(tasks, updatedTasks);
    const updatedFields = Object.keys(stateUpdates) as Array<keyof Task>;

    set({ tasks: updatedTasks });

    try {
      const dirtyTasks = updatedTasks.filter((task) => {
        const original = tasks.find((candidate) => candidate.id === task.id);
        return original && hasPersistedTaskChanges(original, task);
      });

      if (dirtyTasks.length > 1) {
        await api.batchUpdateTasks(dirtyTasks.map(toTaskUpdatePayload));
      } else {
        await api.updateTask(id, toApiTaskUpdates(updates));
      }
    } catch (err) {
      set({
        tasks: rollbackUpdatedTask(get().tasks, tasks, updatedTasks, id, updatedFields, scheduleChangedTaskIds),
        error: err instanceof Error ? err.message : 'Failed to update task',
      });
    }
  },

  createDependency: async (sourceTaskId, targetTaskId, type = 'FS', lag = 0) => {
    const { tasks } = get();
    const targetTask = tasks.find(task => task.id === targetTaskId);
    if (!targetTask || targetTask.dependencies?.some(dependency => dependency.taskId === sourceTaskId)) return;

    const optimisticTasks = applyAutoSchedule(tasks.map(task => task.id === targetTaskId ? {
      ...task,
      dependencies: [...(task.dependencies || []), { taskId: sourceTaskId, type, lag }],
    } : task), [sourceTaskId]);
    const scheduleChangedTaskIds = getScheduleChangedTaskIds(tasks, optimisticTasks);

    set({ tasks: optimisticTasks, error: null });

    try {
      const dependency = await api.createDependency({ sourceTaskId, targetTaskId, type, lag });
      const tasksWithDependencyId = get().tasks.map(task => task.id === targetTaskId ? {
        ...task,
        dependencies: (task.dependencies || []).map(candidate => candidate.taskId === sourceTaskId && !candidate.id ? {
          id: dependency.id,
          taskId: dependency.sourceTaskId,
          type: dependency.type,
          lag: dependency.lag,
        } : candidate),
      } : task);

      set({ tasks: tasksWithDependencyId });
      try {
        await persistScheduleChanges(tasks, tasksWithDependencyId);
      } catch (err) {
        await api.deleteDependency(dependency.id).catch(() => undefined);
        set({
          tasks: rollbackCreatedDependency(get().tasks, tasks, targetTaskId, sourceTaskId, dependency.id, scheduleChangedTaskIds),
          error: err instanceof Error ? err.message : 'Failed to persist schedule changes',
        });
      }
    } catch (err) {
      set({
        tasks: rollbackCreatedDependency(get().tasks, tasks, targetTaskId, sourceTaskId, undefined, scheduleChangedTaskIds),
        error: err instanceof Error ? err.message : 'Failed to create dependency',
      });
    }
  },

  updateDependency: async (targetTaskId, dependencyId, updates) => {
    const { tasks } = get();
    const targetTask = tasks.find(task => task.id === targetTaskId);
    const dependency = targetTask?.dependencies?.find(candidate => candidate.id === dependencyId);
    if (!targetTask || !dependency) return;

    const optimisticTasks = applyAutoSchedule(tasks.map(task => task.id === targetTaskId ? {
      ...task,
      dependencies: (task.dependencies || []).map(candidate => candidate.id === dependencyId ? {
        ...candidate,
        ...updates,
      } : candidate),
    } : task), [dependency.taskId]);
    const scheduleChangedTaskIds = getScheduleChangedTaskIds(tasks, optimisticTasks);

    set({ tasks: optimisticTasks, error: null });

    try {
      const updatedDependency = await api.updateDependency(dependencyId, updates);
      const tasksWithDependency = get().tasks.map(task => task.id === targetTaskId ? {
        ...task,
        dependencies: (task.dependencies || []).map(candidate => candidate.id === dependencyId ? {
          id: updatedDependency.id,
          taskId: updatedDependency.sourceTaskId,
          type: updatedDependency.type,
          lag: updatedDependency.lag,
        } : candidate),
      } : task);

      set({ tasks: tasksWithDependency });
      try {
        await persistScheduleChanges(tasks, tasksWithDependency);
      } catch (err) {
        await api.updateDependency(dependencyId, { type: dependency.type, lag: dependency.lag }).catch(() => undefined);
        set({
          tasks: rollbackUpdatedDependency(get().tasks, tasks, targetTaskId, dependencyId, scheduleChangedTaskIds),
          error: err instanceof Error ? err.message : 'Failed to persist schedule changes',
        });
      }
    } catch (err) {
      set({
        tasks: rollbackUpdatedDependency(get().tasks, tasks, targetTaskId, dependencyId, scheduleChangedTaskIds),
        error: err instanceof Error ? err.message : 'Failed to update dependency',
      });
    }
  },

  deleteDependency: async (targetTaskId, dependencyId) => {
    const { tasks } = get();
    const targetTask = tasks.find(task => task.id === targetTaskId);
    const dependency = targetTask?.dependencies?.find(candidate => candidate.id === dependencyId);
    if (!targetTask || !dependency) return;

    const remainingSourceTaskIds = (targetTask.dependencies || [])
      .filter(candidate => candidate.id !== dependencyId)
      .map(candidate => candidate.taskId);
    const tasksWithoutDependency = tasks.map(task => task.id === targetTaskId ? {
        ...task,
        dependencies: (task.dependencies || []).filter(candidate => candidate.id !== dependencyId),
      } : task);
    const optimisticTasks = remainingSourceTaskIds.length > 0
      ? applyAutoSchedule(tasksWithoutDependency, remainingSourceTaskIds)
      : tasksWithoutDependency;
    const scheduleChangedTaskIds = getScheduleChangedTaskIds(tasks, optimisticTasks);

    set({ tasks: optimisticTasks, error: null });

    try {
      await api.deleteDependency(dependencyId);
      try {
        await persistScheduleChanges(tasks, optimisticTasks);
      } catch (err) {
        const recreatedDependency = await api.createDependency({
          sourceTaskId: dependency.taskId,
          targetTaskId,
          type: dependency.type,
          lag: dependency.lag,
        }).catch(() => null);
        set({
          tasks: rollbackDeletedDependency(get().tasks, tasks, targetTaskId, dependencyId, recreatedDependency?.id, scheduleChangedTaskIds),
          error: err instanceof Error ? err.message : 'Failed to persist schedule changes',
        });
      }
    } catch (err) {
      set({
        tasks: rollbackDeletedDependency(get().tasks, tasks, targetTaskId, dependencyId, undefined, scheduleChangedTaskIds),
        error: err instanceof Error ? err.message : 'Failed to delete dependency',
      });
    }
  },

  deleteTask: async (id) => {
    const { tasks } = get();
    // Optimistic update
    set({ tasks: tasks.filter(t => t.id !== id) });

    try {
      await api.deleteTask(id);
    } catch (err) {
      set({ tasks, error: err instanceof Error ? err.message : 'Failed to delete task' });
    }
  },

  toggleAiSidebar: () => set((state) => ({ isAiSidebarOpen: !state.isAiSidebarOpen })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  setSearchQuery: (query) => set({ searchQuery: query, activeSearchResultIndex: -1 }),
  advanceSearchResult: () => {
    const { tasks, searchQuery, activeSearchResultIndex } = get();
    const results = getSearchResults(tasks, searchQuery);
    set({ activeSearchResultIndex: nextSearchResultIndex(activeSearchResultIndex, results.length) });
  },
  setDependencyViewMode: (mode) => set({ dependencyViewMode: mode }),
  clearError: () => set({ error: null }),
}));

function resetProjectScopedState(extra: Partial<AppState> = {}): Partial<AppState> {
  return {
    selectedTaskId: null,
    searchQuery: '',
    activeSearchResultIndex: -1,
    aiMessages: [],
    ...extra,
  };
}

function readCurrentProjectId() {
  if (typeof globalThis.localStorage === 'undefined') {
    return null;
  }

  return globalThis.localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY);
}

function writeCurrentProjectId(projectId: string | null) {
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }

  if (projectId) {
    globalThis.localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, projectId);
  } else {
    globalThis.localStorage.removeItem(CURRENT_PROJECT_STORAGE_KEY);
  }
}

function hasPersistedTaskChanges(previous: Task, next: Task) {
  return previous.title !== next.title
    || previous.status !== next.status
    || previous.priority !== next.priority
    || previous.plannedStart !== next.plannedStart
    || previous.plannedEnd !== next.plannedEnd
    || previous.progress !== next.progress
    || previous.parentId !== next.parentId;
}

function toTaskUpdatePayload(task: Task) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    plannedStart: task.plannedStart,
    plannedEnd: task.plannedEnd,
    progress: task.progress,
    parentId: task.parentId,
  };
}

function normalizeTaskUpdatesForState(updates: TaskEditableUpdates): Partial<Task> {
  if (!('parentId' in updates)) return updates as Partial<Task>;
  const { parentId, ...rest } = updates;
  return {
    ...rest,
    parentId: parentId ?? undefined,
  };
}

function toApiTaskUpdates(updates: TaskEditableUpdates): Parameters<typeof api.updateTask>[1] {
  return updates as unknown as Parameters<typeof api.updateTask>[1];
}

function toScheduleUpdatePayload(task: Task) {
  return {
    id: task.id,
    plannedStart: task.plannedStart,
    plannedEnd: task.plannedEnd,
  };
}

async function persistScheduleChanges(previousTasks: Task[], nextTasks: Task[]) {
  const dirtyTasks = nextTasks.filter((task) => {
    const original = previousTasks.find((candidate) => candidate.id === task.id);
    return original
      && (original.plannedStart !== task.plannedStart || original.plannedEnd !== task.plannedEnd);
  });

  if (dirtyTasks.length > 0) {
    await api.batchUpdateTasks(dirtyTasks.map(toScheduleUpdatePayload));
  }
}

function getScheduleChangedTaskIds(previousTasks: Task[], nextTasks: Task[]) {
  return nextTasks
    .filter((task) => {
      const original = previousTasks.find((candidate) => candidate.id === task.id);
      return original
        && (original.plannedStart !== task.plannedStart || original.plannedEnd !== task.plannedEnd);
    })
    .map((task) => task.id);
}

function restoreScheduleFields(currentTasks: Task[], previousTasks: Task[], taskIds: string[]) {
  const taskIdSet = new Set(taskIds);
  return currentTasks.map((task) => {
    if (!taskIdSet.has(task.id)) return task;
    const previousTask = previousTasks.find((candidate) => candidate.id === task.id);
    if (!previousTask) return task;
    return {
      ...task,
      plannedStart: previousTask.plannedStart,
      plannedEnd: previousTask.plannedEnd,
    };
  });
}

function rollbackCreatedDependency(
  currentTasks: Task[],
  previousTasks: Task[],
  targetTaskId: string,
  sourceTaskId: string,
  dependencyId: string | undefined,
  scheduleChangedTaskIds: string[],
) {
  const restoredTasks = restoreScheduleFields(currentTasks, previousTasks, scheduleChangedTaskIds);

  return restoredTasks.map((task) => task.id === targetTaskId ? {
    ...task,
    dependencies: compactDependencies((task.dependencies || []).filter((dependency) => {
      if (dependencyId && dependency.id === dependencyId) return false;
      return !(dependency.taskId === sourceTaskId && !dependency.id);
    })),
  } : task);
}

function rollbackUpdatedDependency(
  currentTasks: Task[],
  previousTasks: Task[],
  targetTaskId: string,
  dependencyId: string,
  scheduleChangedTaskIds: string[],
) {
  const previousDependency = previousTasks
    .find((task) => task.id === targetTaskId)
    ?.dependencies
    ?.find((dependency) => dependency.id === dependencyId);
  const restoredTasks = restoreScheduleFields(currentTasks, previousTasks, scheduleChangedTaskIds);

  if (!previousDependency) return restoredTasks;

  return restoredTasks.map((task) => task.id === targetTaskId ? {
    ...task,
    dependencies: (task.dependencies || []).map((dependency) => dependency.id === dependencyId
      ? previousDependency
      : dependency),
  } : task);
}

function rollbackDeletedDependency(
  currentTasks: Task[],
  previousTasks: Task[],
  targetTaskId: string,
  dependencyId: string,
  recreatedDependencyId: string | undefined,
  scheduleChangedTaskIds: string[],
) {
  const previousDependency = previousTasks
    .find((task) => task.id === targetTaskId)
    ?.dependencies
    ?.find((dependency) => dependency.id === dependencyId);
  const restoredTasks = restoreScheduleFields(currentTasks, previousTasks, scheduleChangedTaskIds);

  if (!previousDependency) return restoredTasks;

  const restoredDependency = recreatedDependencyId
    ? { ...previousDependency, id: recreatedDependencyId }
    : previousDependency;

  return restoredTasks.map((task) => task.id === targetTaskId ? {
    ...task,
    dependencies: compactDependencies([
      restoredDependency,
      ...(task.dependencies || []).filter((dependency) => dependency.id !== dependencyId && dependency.taskId !== previousDependency.taskId),
    ]),
  } : task);
}

function rollbackUpdatedTask(
  currentTasks: Task[],
  previousTasks: Task[],
  optimisticTasks: Task[],
  updatedTaskId: string,
  updatedFields: Array<keyof Task>,
  scheduleChangedTaskIds: string[],
) {
  const previousById = new Map(previousTasks.map(task => [task.id, task]));
  const optimisticById = new Map(optimisticTasks.map(task => [task.id, task]));
  const scheduleChangedTaskIdSet = new Set(scheduleChangedTaskIds);

  return currentTasks.map((currentTask) => {
    const previousTask = previousById.get(currentTask.id);
    const optimisticTask = optimisticById.get(currentTask.id);
    if (!previousTask || !optimisticTask) return currentTask;

    let rolledBackTask = currentTask;

    if (currentTask.id === updatedTaskId) {
      rolledBackTask = rollbackTaskFields(rolledBackTask, previousTask, optimisticTask, updatedFields);
    }

    if (scheduleChangedTaskIdSet.has(currentTask.id)) {
      rolledBackTask = rollbackTaskFields(rolledBackTask, previousTask, optimisticTask, ['plannedStart', 'plannedEnd']);
    }

    return rolledBackTask;
  });
}

function rollbackTaskFields(
  currentTask: Task,
  previousTask: Task,
  optimisticTask: Task,
  fields: Array<keyof Task>,
) {
  return fields.reduce<Task>((task, field) => {
    if (!Object.is(task[field], optimisticTask[field])) return task;
    return {
      ...task,
      [field]: previousTask[field],
    };
  }, currentTask);
}

function compactDependencies(dependencies: NonNullable<Task['dependencies']>) {
  return dependencies.length > 0 ? dependencies : undefined;
}

function rollbackMovedTask(
  currentTasks: Task[],
  previousOrder: string[],
  draggedId: string,
  previousDraggedParentId: string | undefined,
) {
  const previousOrderSet = new Set(previousOrder);
  const currentById = new Map(currentTasks.map(task => [task.id, task]));
  const restoredExistingTasks = previousOrder.flatMap((taskId) => {
    const currentTask = currentById.get(taskId);
    if (!currentTask) return [];
    return [{
      ...currentTask,
      ...(taskId === draggedId ? { parentId: previousDraggedParentId } : {}),
      ...(taskId === draggedId && previousDraggedParentId === undefined ? { parentId: undefined } : {}),
    }];
  });
  const concurrentNewTasks = currentTasks.filter(task => !previousOrderSet.has(task.id));

  return [...restoredExistingTasks, ...concurrentNewTasks];
}

function applyAutoSchedule(tasks: Task[], startingTaskIds: string[]) {
  let updatedTasks = tasks;
  const visited = new Set<string>();
  const stack = [...startingTaskIds];

  while(stack.length > 0) {
    const currentId = stack.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const predecessor = updatedTasks.find(t => t.id === currentId);
    if (!predecessor) continue;

    const successors = updatedTasks.filter(t => t.dependencies?.some(d => d.taskId === currentId));
    
    for (const succ of successors) {
      let maxReqStart: number | null = null;
      let maxReqEnd: number | null = null;
      
      let sStart = parseDateOnlyUtc(succ.plannedStart);
      let sEnd = parseDateOnlyUtc(succ.plannedEnd);
      const duration = sEnd.getTime() - sStart.getTime();

      // Find max constraints from all dependencies for this successor
      for (const dep of succ.dependencies || []) {
        const preTask = updatedTasks.find(t => t.id === dep.taskId);
        if (!preTask) continue;
        
        const preTaskStart = parseDateOnlyUtc(preTask.plannedStart).getTime();
        const preTaskEnd = parseDateOnlyUtc(preTask.plannedEnd).getTime();
        const lagMs = dep.lag * 24 * 60 * 60 * 1000;

        if (dep.type === 'FS') {
          maxReqStart = Math.max(maxReqStart || -Infinity, preTaskEnd + lagMs);
        } else if (dep.type === 'SS') {
          maxReqStart = Math.max(maxReqStart || -Infinity, preTaskStart + lagMs);
        } else if (dep.type === 'FF') {
          maxReqEnd = Math.max(maxReqEnd || -Infinity, preTaskEnd + lagMs);
        } else if (dep.type === 'SF') {
          maxReqEnd = Math.max(maxReqEnd || -Infinity, preTaskStart + lagMs);
        }
      }

      let changed = false;
      
      if (maxReqStart !== null) {
        if (sStart.getTime() !== maxReqStart) {
          sStart = new Date(maxReqStart);
          sEnd = new Date(sStart.getTime() + duration);
          changed = true;
        }
      } else if (maxReqEnd !== null) {
         if (sEnd.getTime() !== maxReqEnd) {
           sEnd = new Date(maxReqEnd);
           sStart = new Date(sEnd.getTime() - duration);
           changed = true;
         }
      }

      if (changed) {
        const formatD = (d: Date) => d.toISOString().split('T')[0];
        updatedTasks = updatedTasks.map(t => t.id === succ.id ? { 
          ...t, 
          plannedStart: formatD(sStart), 
          plannedEnd: formatD(sEnd) 
        } : t);
        stack.push(succ.id); // Add modified successor to update its successors
      }
    }
  }

  return updatedTasks;
}

function parseDateOnlyUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
