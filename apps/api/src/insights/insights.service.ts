import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateInsightDto, InsightType } from './dto/create-insight.dto';

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}

  async create(createInsightDto: CreateInsightDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: createInsightDto.projectId },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with ID ${createInsightDto.projectId} not found`,
      );
    }

    return this.prisma.aIInsight.create({
      data: {
        type: createInsightDto.type,
        content: createInsightDto.content,
        reasoning: createInsightDto.reasoning || '',
        project: {
          connect: { id: createInsightDto.projectId },
        },
      },
    });
  }

  async findAll(projectId?: string, type?: InsightType) {
    const where: any = {};

    if (projectId) {
      where.projectId = projectId;
    }

    if (type) {
      where.type = type;
    }

    return this.prisma.aIInsight.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const insight = await this.prisma.aIInsight.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    if (!insight) {
      throw new NotFoundException(`Insight with ID ${id} not found`);
    }

    return insight;
  }

  async remove(id: string) {
    const insight = await this.prisma.aIInsight.findUnique({
      where: { id },
    });

    if (!insight) {
      throw new NotFoundException(`Insight with ID ${id} not found`);
    }

    return this.prisma.aIInsight.delete({
      where: { id },
    });
  }

  async generateProjectInsights(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(
      (t: any) => t.status === 'COMPLETED',
    ).length;
    const inProgressTasks = project.tasks.filter(
      (t: any) => t.status === 'IN_PROGRESS',
    ).length;
    const pendingTasks = project.tasks.filter(
      (t: any) => t.status === 'PENDING',
    ).length;

    const progressPercentage = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    const insights: CreateInsightDto[] = [];

    insights.push({
      projectId,
      type: InsightType.SUMMARY,
      content: `Project "${project.name}" has ${totalTasks} total tasks. ${completedTasks} completed, ${inProgressTasks} in progress, ${pendingTasks} pending. Overall progress: ${progressPercentage}%`,
      reasoning: JSON.stringify({
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        progressPercentage,
      }),
    });

    if (inProgressTasks === 0 && completedTasks < totalTasks) {
      insights.push({
        projectId,
        type: InsightType.BOTTLENECK,
        content: 'No tasks are currently in progress. Consider starting some tasks to maintain momentum.',
        reasoning: JSON.stringify({ detectedAt: new Date() }),
      });
    }

    if (progressPercentage < 30 && totalTasks > 5) {
      insights.push({
        projectId,
        type: InsightType.RISK,
        content: 'Project progress is below 30%. Consider breaking down tasks into smaller chunks to improve velocity.',
        reasoning: JSON.stringify({ progressPercentage, threshold: 30 }),
      });
    }

    if (progressPercentage >= 80) {
      insights.push({
        projectId,
        type: InsightType.PROGRESS,
        content: 'Excellent progress! Project is over 80% complete. Consider scheduling a review.',
        reasoning: JSON.stringify({ progressPercentage }),
      });
    }

    const savedInsights = await Promise.all(
      insights.map((insight) => this.create(insight)),
    );

    return savedInsights;
  }
}
