export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type DependencyType = 'FS' | 'FF' | 'SS' | 'SF';

export interface TaskDependency {
  taskId: string;
  type: DependencyType;
  lag: number;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  plannedStart: string; // ISO format YYYY-MM-DD
  plannedEnd: string;
  progress: number;
  dependencies?: TaskDependency[]; // Array of detailed dependencies
  parentId?: string; // ID of the parent task, for subtasks
}

export interface Project {
  id: string;
  name: string;
  release_status: string;
  requirement_coverage: number;
  risk_coverage: number;
  validation_coverage: number;
  open_issues: number;
  pending_reviews: number;
  pending_approvals: number;
}
