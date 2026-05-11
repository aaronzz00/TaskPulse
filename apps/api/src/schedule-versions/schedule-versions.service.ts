import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateScheduleVersionDto } from './dto/create-schedule-version.dto';

@Injectable()
export class ScheduleVersionsService {
  constructor(private prisma: PrismaService) {}

  async createSnapshot(projectId: string, dto: CreateScheduleVersionDto) {
    return this.prisma.$transaction((tx) => this.createSnapshotInTransaction(tx, projectId, dto));
  }

  async findAll(projectId: string) {
    return this.prisma.scheduleVersion.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async restore(projectId: string, versionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.scheduleVersion.findUnique({
        where: { id: versionId },
      });

      if (!version || version.projectId !== projectId) {
        throw new NotFoundException(`Schedule version with ID ${versionId} not found`);
      }

      await this.createSnapshotInTransaction(tx, projectId, {
        name: `Rollback before restoring ${versionId}`,
        type: 'rollback',
      });

      const snapshot = version.snapshotJson as any;

      await tx.dependency.deleteMany({
        where: {
          OR: [{ sourceTask: { projectId } }, { targetTask: { projectId } }],
        },
      });
      await tx.task.deleteMany({ where: { projectId } });

      for (const task of snapshot.tasks ?? []) {
        await tx.task.create({
          data: this.toTaskRestoreData(projectId, task),
        });
      }

      for (const dependency of snapshot.dependencies ?? []) {
        await tx.dependency.create({
          data: {
            sourceTaskId: dependency.sourceTaskId,
            targetTaskId: dependency.targetTaskId,
            type: dependency.type,
            lag: dependency.lag,
            source: dependency.source,
          },
        });
      }

      const restoredProject = await tx.project.update({
        where: { id: projectId },
        data: {
          name: snapshot.project?.name,
          description: snapshot.project?.description,
          startDate: snapshot.project?.startDate ? new Date(snapshot.project.startDate) : undefined,
          endDate: snapshot.project?.endDate ? new Date(snapshot.project.endDate) : undefined,
          status: snapshot.project?.status,
        },
      });

      return restoredProject;
    });
  }

  private async createSnapshotInTransaction(tx: any, projectId: string, dto: CreateScheduleVersionDto) {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          include: {
            dependents: true,
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const snapshot = this.toSnapshot(project);

    if (dto.isBaseline) {
      await tx.scheduleVersion.updateMany({
        where: { projectId, isBaseline: true },
        data: { isBaseline: false },
      });
    }

    return tx.scheduleVersion.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description ?? '',
        type: dto.type ?? 'manual',
        snapshotJson: snapshot,
        taskCount: snapshot.tasks.length,
        dependencyCount: snapshot.dependencies.length,
        isBaseline: dto.isBaseline ?? false,
      },
    });
  }

  private toSnapshot(project: any) {
    const dependencies = this.getUniqueDependencies(project.tasks);

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        startDate: this.toIso(project.startDate),
        endDate: this.toIso(project.endDate),
        status: project.status,
      },
      tasks: project.tasks.map((task: any) => ({
        id: task.id,
        displayId: task.displayId,
        parentId: task.parentId,
        title: task.title,
        description: task.description,
        status: task.status,
        assigneeId: task.assigneeId,
        plannedStart: this.toIso(task.plannedStart),
        plannedEnd: this.toIso(task.plannedEnd),
        actualStart: this.toIso(task.actualStart),
        actualEnd: this.toIso(task.actualEnd),
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
        priority: task.priority,
        progress: task.progress,
        aiConfidence: task.aiConfidence,
        aiReasoning: task.aiReasoning,
      })),
      dependencies,
    };
  }

  private getUniqueDependencies(tasks: any[]) {
    const seen = new Set<string>();
    const dependencies: any[] = [];

    for (const task of tasks) {
      for (const dependency of task.dependents ?? []) {
        const key = `${dependency.sourceTaskId}:${dependency.targetTaskId}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        dependencies.push({
          sourceTaskId: dependency.sourceTaskId,
          targetTaskId: dependency.targetTaskId,
          type: dependency.type,
          lag: dependency.lag,
          source: dependency.source,
        });
      }
    }

    return dependencies;
  }

  private toTaskRestoreData(projectId: string, task: any) {
    return {
      id: task.id,
      displayId: task.displayId,
      projectId,
      parentId: task.parentId,
      title: task.title,
      description: task.description,
      status: task.status,
      assigneeId: task.assigneeId,
      plannedStart: new Date(task.plannedStart),
      plannedEnd: new Date(task.plannedEnd),
      actualStart: task.actualStart ? new Date(task.actualStart) : null,
      actualEnd: task.actualEnd ? new Date(task.actualEnd) : null,
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      priority: task.priority,
      progress: task.progress,
      aiConfidence: task.aiConfidence,
      aiReasoning: task.aiReasoning,
    };
  }

  private toIso(value: Date | string | null | undefined) {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}
