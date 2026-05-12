export type DateLike = string | Date;

export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type WorkspaceTaskStatus = Exclude<TaskStatus, 'cancelled'>;
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface BackendProject {
  id: string;
  name: string;
  description: string;
  startDate: DateLike;
  endDate: DateLike;
  status: ProjectStatus;
  createdAt: DateLike;
  updatedAt: DateLike;
}

export interface BackendTask {
  id: string;
  displayId?: string | null;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string | null;
  plannedStart: DateLike;
  plannedEnd: DateLike;
  actualStart: DateLike | null;
  actualEnd: DateLike | null;
  estimatedHours: number;
  actualHours: number;
  priority: TaskPriority;
  progress: number;
  dependencies?: BackendDependency[];
  aiMetadata?: {
    confidence: number;
    reasoning: string;
  };
}

export interface BackendDependency {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  type: DependencyType;
  lag: number;
  source?: 'manual' | 'ai_suggested' | 'ai_confirmed';
}

export interface WorkspaceTaskDependency {
  id?: string;
  taskId: string;
  type: DependencyType;
  lag: number;
}

export interface WorkspaceTask {
  id: string;
  displayId?: string;
  title: string;
  description: string;
  status: WorkspaceTaskStatus;
  priority: TaskPriority;
  plannedStart: string;
  plannedEnd: string;
  progress: number;
  parentId?: string;
  dependencies?: WorkspaceTaskDependency[];
}

export interface WorkspaceProject {
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

export interface AIInsight {
  id: string;
  projectId: string;
  taskId: string | null;
  type: 'risk_warning' | 'schedule_suggestion' | 'dependency_suggestion';
  severity: 'info' | 'warning' | 'critical';
  content: string;
  reasoning: string;
  actionTaken: 'adopted' | 'dismissed' | 'modified' | null;
  createdAt: Date;
}

export type Project = BackendProject;
export type Task = BackendTask;
export type Dependency = BackendDependency;

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: 'admin' | 'member' | 'viewer';
  capacity: number;
}
