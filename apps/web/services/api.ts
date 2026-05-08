import { Task, Project } from '@/types';

// Simulate network latency for backend requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  // Task Endpoints
  fetchTasks: async (projectId: string): Promise<Task[]> => {
    await delay(600); // Mock network loading
    return [
      { id: '1', title: 'Phase 1: Research & Planning', status: 'done', priority: 'medium', plannedStart: '2026-05-01', plannedEnd: '2026-05-03', progress: 100 },
      { id: '2', title: 'Frontend Scaffold & UI', status: 'in_progress', priority: 'critical', plannedStart: '2026-05-04', plannedEnd: '2026-05-10', progress: 40 },
      { id: '2-1', title: 'Design System Set Up', status: 'done', priority: 'medium', plannedStart: '2026-05-04', plannedEnd: '2026-05-05', progress: 100, parentId: '2' },
      { id: '2-2', title: 'Core Layout Components', status: 'in_progress', priority: 'high', plannedStart: '2026-05-06', plannedEnd: '2026-05-08', progress: 50, parentId: '2' },
      { id: '2-3', title: 'State Management', status: 'todo', priority: 'high', plannedStart: '2026-05-08', plannedEnd: '2026-05-10', progress: 0, parentId: '2' },
      { id: '3', title: 'Gantt Chart Interactive Component', status: 'todo', priority: 'high', plannedStart: '2026-05-10', plannedEnd: '2026-05-15', progress: 0, dependencies: [{ taskId: '2', type: 'FS', lag: 0 }] },
      { id: '4', title: 'Backend API Integration', status: 'todo', priority: 'high', plannedStart: '2026-05-12', plannedEnd: '2026-05-20', progress: 0 },
    ];
  },

  createTask: async (task: Omit<Task, 'id'>, projectId: string): Promise<Task> => {
    await delay(400);
    return { ...task, id: Math.random().toString(36).substr(2, 9) };
  },

  updateTask: async (id: string, updates: Partial<Task>): Promise<Task> => {
    await delay(400);
    // In a real app, this would return the updated task from DB
    return { id, ...updates } as Task; 
  },

  deleteTask: async (id: string): Promise<boolean> => {
    await delay(400);
    return true;
  },

  // Project Endpoints
  fetchProjectOverview: async (projectId: string): Promise<Project> => {
    await delay(500);
    return {
      id: projectId,
      name: 'E-commerce Rebrand 2024',
      release_status: 'On Track',
      requirement_coverage: 85,
      risk_coverage: 92,
      validation_coverage: 78,
      open_issues: 12,
      pending_reviews: 4,
      pending_approvals: 2,
    };
  }
};
