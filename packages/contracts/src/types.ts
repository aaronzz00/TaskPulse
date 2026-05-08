export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'active' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  assigneeId: string | null;
  plannedStart: Date;
  plannedEnd: Date;
  actualStart: Date | null;
  actualEnd: Date | null;
  estimatedHours: number;
  actualHours: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  progress: number;
  aiMetadata?: {
    confidence: number;
    reasoning: string;
  };
}

export interface Dependency {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number;
  source: 'manual' | 'ai_suggested' | 'ai_confirmed';
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

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: 'admin' | 'member' | 'viewer';
  capacity: number;
}
