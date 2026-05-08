import { create } from 'zustand';
import { Task, Project } from '@/types';
import { api } from '@/services/api';

interface AppState {
  tasks: Task[];
  project: Project | null;
  isLoading: boolean;
  error: string | null;
  currentProjectId: string | null;
  isAiSidebarOpen: boolean;
  viewMode: 'day' | 'week' | 'month';
  selectedTaskId: string | null;
  
  // Actions
  fetchData: () => Promise<void>;
  createTask: (task: Omit<Task, 'id'>) => Promise<void>;
  updateTaskProgress: (id: string, progress: number) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  moveTask: (draggedId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  deleteTask: (id: string) => Promise<void>;
  
  toggleAiSidebar: () => void;
  setViewMode: (mode: 'day' | 'week' | 'month') => void;
  setSelectedTask: (id: string | null) => void;
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
  
  fetchData: async () => {
    const { currentProjectId } = get();

    set({ isLoading: true, error: null });
    try {
      const projects = await api.fetchProjects();
      const selectedProject = projects.find(project => project.id === currentProjectId) ?? projects[0];

      if (!selectedProject) {
        set({ tasks: [], project: null, currentProjectId: null, isLoading: false });
        return;
      }

      const tasks = await api.fetchTasks(selectedProject.id);
      const project = await api.fetchProjectOverview(selectedProject.id, tasks);
      set({ tasks, project, currentProjectId: selectedProject.id, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch data', isLoading: false });
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

  moveTask: (draggedId, targetId, position) => {
    const { tasks } = get();
    const dragged = tasks.find(t => t.id === draggedId);
    const target = tasks.find(t => t.id === targetId);
    if (!dragged || !target || dragged.id === target.id) return;

    let newTasks = [...tasks];
    
    // Remove dragged task from array
    const draggedIndex = newTasks.findIndex(t => t.id === draggedId);
    newTasks.splice(draggedIndex, 1);

    if (position === 'inside') {
      dragged.parentId = targetId;
      newTasks.push(dragged); // We'll just push to end, filter maintains order
    } else {
      dragged.parentId = target.parentId;
      const targetIndex = newTasks.findIndex(t => t.id === targetId);
      const insertAt = position === 'before' ? targetIndex : targetIndex + 1;
      newTasks.splice(insertAt, 0, dragged);
    }

    set({ tasks: newTasks });
  },

  updateTask: async (id, updates) => {
    const { tasks } = get();

    let updatedTasks = tasks.map(t => t.id === id ? { ...t, ...updates } : t);

    // Auto-schedule engine
    const visited = new Set<string>();
    const stack = [id];

    while(stack.length > 0) {
      const currentId = stack.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const predecessor = updatedTasks.find(t => t.id === currentId);
      if (!predecessor) continue;

      const pStart = new Date(predecessor.plannedStart + 'T00:00:00');
      const pEnd = new Date(predecessor.plannedEnd + 'T00:00:00');

      const successors = updatedTasks.filter(t => t.dependencies?.some(d => d.taskId === currentId));
      
      for (const succ of successors) {
        let maxReqStart: number | null = null;
        let maxReqEnd: number | null = null;
        
        let sStart = new Date(succ.plannedStart + 'T00:00:00');
        let sEnd = new Date(succ.plannedEnd + 'T00:00:00');
        const duration = sEnd.getTime() - sStart.getTime();

        // Find max constraints from all dependencies for this successor
        for (const dep of succ.dependencies || []) {
          const preTask = updatedTasks.find(t => t.id === dep.taskId);
          if (!preTask) continue;
          
          const preTaskStart = new Date(preTask.plannedStart + 'T00:00:00').getTime();
          const preTaskEnd = new Date(preTask.plannedEnd + 'T00:00:00').getTime();
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

    set({ tasks: updatedTasks });

    try {
      const dirtyTasks = updatedTasks.filter((task) => {
        const original = tasks.find((candidate) => candidate.id === task.id);
        return original && hasPersistedTaskChanges(original, task);
      });

      if (dirtyTasks.length > 1) {
        await api.batchUpdateTasks(dirtyTasks.map(toTaskUpdatePayload));
      } else {
        await api.updateTask(id, updates);
      }
    } catch (err) {
      set({ tasks, error: err instanceof Error ? err.message : 'Failed to update task' });
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
}));

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
