import { Injectable } from '@nestjs/common';

export interface TaskNode {
  id: string;
  title: string;
  estimatedHours: number;
  plannedStart: Date;
  plannedEnd: Date;
  dependencies: string[];
}

export interface TaskDateInfo {
  earliestStart: Date;
  earliestFinish: Date;
  latestStart: Date;
  latestFinish: Date;
  slack: number;
}

export interface ScheduleResult {
  criticalPath: string[];
  taskDates: Map<string, TaskDateInfo>;
  projectDuration: number;
}

@Injectable()
export class SchedulingService {
  /**
   * Calculate critical path using BFS and forward/backward pass
   */
  calculateCriticalPath(tasks: TaskNode[]): ScheduleResult {
    const taskMap = new Map<string, TaskNode>();
    const dependentsMap = new Map<string, string[]>();

    // Build task and dependents map
    tasks.forEach(task => {
      taskMap.set(task.id, task);
      dependentsMap.set(task.id, []);
    });

    tasks.forEach(task => {
      task.dependencies.forEach(depId => {
        const dependents = dependentsMap.get(depId);
        if (dependents) {
          dependents.push(task.id);
        }
      });
    });

    // Forward pass - calculate earliest start and finish
    const earliestStart = new Map<string, number>();
    const earliestFinish = new Map<string, number>();

    // BFS topological order
    const inDegree = new Map<string, number>();
    tasks.forEach(task => {
      inDegree.set(task.id, task.dependencies.length);
    });

    const queue: string[] = [];
    tasks.forEach(task => {
      if (task.dependencies.length === 0) {
        queue.push(task.id);
        earliestStart.set(task.id, 0);
        earliestFinish.set(task.id, task.estimatedHours);
      }
    });

    while (queue.length > 0) {
      const taskId = queue.shift()!;
      const dependents = dependentsMap.get(taskId) || [];

      dependents.forEach(depId => {
        const currentEF = earliestFinish.get(taskId)!;
        const existingES = earliestStart.get(depId) || 0;
        
        if (currentEF > existingES) {
          earliestStart.set(depId, currentEF);
          const task = taskMap.get(depId)!;
          earliestFinish.set(depId, currentEF + task.estimatedHours);
        }

        const newInDegree = (inDegree.get(depId) || 0) - 1;
        inDegree.set(depId, newInDegree);
        
        if (newInDegree === 0) {
          queue.push(depId);
        }
      });
    }

    // Find project duration
    let projectDuration = 0;
    tasks.forEach(task => {
      const ef = earliestFinish.get(task.id) || 0;
      if (ef > projectDuration) {
        projectDuration = ef;
      }
    });

    // Backward pass - calculate latest start and finish
    const latestStart = new Map<string, number>();
    const latestFinish = new Map<string, number>();

    // Initialize sink nodes
    tasks.forEach(task => {
      const dependents = dependentsMap.get(task.id) || [];
      if (dependents.length === 0) {
        latestFinish.set(task.id, projectDuration);
        latestStart.set(task.id, projectDuration - task.estimatedHours);
      }
    });

    // Reverse topological processing
    const visited = new Set<string>();
    const outDegree = new Map<string, number>();
    
    tasks.forEach(task => {
      const dependents = dependentsMap.get(task.id) || [];
      outDegree.set(task.id, dependents.length);
    });

    const reverseQueue: string[] = [];
    tasks.forEach(task => {
      const dependents = dependentsMap.get(task.id) || [];
      if (dependents.length === 0) {
        reverseQueue.push(task.id);
      }
    });

    while (reverseQueue.length > 0) {
      const taskId = reverseQueue.shift()!;
      const task = taskMap.get(taskId)!;

      task.dependencies.forEach(depId => {
        const currentLS = latestStart.get(taskId)!;
        const existingLF = latestFinish.get(depId) || Number.MAX_VALUE;
        
        if (currentLS < existingLF) {
          latestFinish.set(depId, currentLS);
          const depTask = taskMap.get(depId)!;
          latestStart.set(depId, currentLS - depTask.estimatedHours);
        }

        const newOutDegree = (outDegree.get(depId) || 0) - 1;
        outDegree.set(depId, newOutDegree);
        
        if (newOutDegree === 0) {
          reverseQueue.push(depId);
        }
      });
    }

    // Calculate slack and identify critical path
    const slack = new Map<string, number>();
    const taskDates = new Map<string, TaskDateInfo>();

    tasks.forEach(task => {
      const ls = latestStart.get(task.id) || 0;
      const es = earliestStart.get(task.id) || 0;
      const taskSlack = ls - es;
      slack.set(task.id, taskSlack);

      taskDates.set(task.id, {
        earliestStart: this.addHours(new Date(), es),
        earliestFinish: this.addHours(new Date(), earliestFinish.get(task.id) || 0),
        latestStart: this.addHours(new Date(), ls),
        latestFinish: this.addHours(new Date(), latestFinish.get(task.id) || 0),
        slack: taskSlack,
      });
    });

    // Critical path - tasks with zero slack
    const criticalPath = tasks
      .filter(task => (slack.get(task.id) || 0) <= 0)
      .sort((a, b) => (earliestStart.get(a.id) || 0) - (earliestStart.get(b.id) || 0))
      .map(task => task.id);

    return {
      criticalPath,
      taskDates,
      projectDuration,
    };
  }

  private addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setTime(result.getTime() + hours * 60 * 60 * 1000);
    return result;
  }

  /**
   * BFS to validate no circular dependencies
   */
  validateNoCyclicDependencies(tasks: TaskNode[]): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const taskMap = new Map<string, string[]>();

    tasks.forEach(task => {
      taskMap.set(task.id, task.dependencies);
    });

    const dfs = (taskId: string): boolean => {
      if (recStack.has(taskId)) return false;
      if (visited.has(taskId)) return true;

      visited.add(taskId);
      recStack.add(taskId);

      const dependencies = taskMap.get(taskId) || [];
      for (const depId of dependencies) {
        if (!dfs(depId)) return false;
      }

      recStack.delete(taskId);
      return true;
    };

    for (const task of tasks) {
      if (!dfs(task.id)) return false;
    }

    return true;
  }
}
