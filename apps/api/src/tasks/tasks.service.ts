import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { SchedulingService } from './scheduling.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private schedulingService: SchedulingService,
  ) {}

  async create(createTaskDto: CreateTaskDto) {
    // Validate project exists
    const project = await this.prisma.project.findUnique({
      where: { id: createTaskDto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${createTaskDto.projectId} not found`);
    }

    // Validate parent task exists if provided
    if (createTaskDto.parentId) {
      const parentTask = await this.prisma.task.findUnique({
        where: { id: createTaskDto.parentId },
      });
      if (!parentTask) {
        throw new NotFoundException(`Parent task with ID ${createTaskDto.parentId} not found`);
      }
    }

    return this.prisma.task.create({
      data: {
        ...createTaskDto,
        plannedStart: new Date(createTaskDto.plannedStart),
        plannedEnd: new Date(createTaskDto.plannedEnd),
        actualStart: createTaskDto.actualStart ? new Date(createTaskDto.actualStart) : null,
        actualEnd: createTaskDto.actualEnd ? new Date(createTaskDto.actualEnd) : null,
      },
    });
  }

  async findAll(projectId?: string) {
    const where = projectId ? { projectId } : {};
    return this.prisma.task.findMany({
      where,
      include: {
        dependencies: {
          select: {
            id: true,
            sourceTaskId: true,
            targetTaskId: true,
            type: true,
            lag: true,
          },
        },
        children: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        dependencies: true,
        dependents: true,
        children: true,
        project: true,
        insights: true,
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto) {
    const data: any = { ...updateTaskDto };
    
    if (updateTaskDto.plannedStart) {
      data.plannedStart = new Date(updateTaskDto.plannedStart);
    }
    if (updateTaskDto.plannedEnd) {
      data.plannedEnd = new Date(updateTaskDto.plannedEnd);
    }
    if (updateTaskDto.actualStart) {
      data.actualStart = new Date(updateTaskDto.actualStart);
    }
    if (updateTaskDto.actualEnd) {
      data.actualEnd = new Date(updateTaskDto.actualEnd);
    }

    return this.prisma.task.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.task.delete({
      where: { id },
    });
  }

  async getCriticalPath(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          include: {
            dependencies: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const taskNodes = project.tasks.map(task => ({
      id: task.id,
      title: task.title,
      estimatedHours: task.estimatedHours,
      plannedStart: task.plannedStart,
      plannedEnd: task.plannedEnd,
      dependencies: task.dependencies.map(d => d.sourceTaskId),
    }));

    if (!this.schedulingService.validateNoCyclicDependencies(taskNodes)) {
      throw new BadRequestException('Circular dependencies detected in project tasks');
    }

    return this.schedulingService.calculateCriticalPath(taskNodes);
  }
}
