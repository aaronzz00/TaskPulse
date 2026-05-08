import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateDependencyDto } from './dto/create-dependency.dto';
import { UpdateDependencyDto } from './dto/update-dependency.dto';

@Injectable()
export class DependenciesService {
  constructor(private prisma: PrismaService) {}

  async create(createDependencyDto: CreateDependencyDto) {
    // Validate both tasks exist
    const [sourceTask, targetTask] = await Promise.all([
      this.prisma.task.findUnique({ where: { id: createDependencyDto.sourceTaskId } }),
      this.prisma.task.findUnique({ where: { id: createDependencyDto.targetTaskId } }),
    ]);

    if (!sourceTask) {
      throw new NotFoundException(`Source task with ID ${createDependencyDto.sourceTaskId} not found`);
    }
    if (!targetTask) {
      throw new NotFoundException(`Target task with ID ${createDependencyDto.targetTaskId} not found`);
    }

    // Check if dependency already exists
    const existing = await this.prisma.dependency.findUnique({
      where: {
        sourceTaskId_targetTaskId: {
          sourceTaskId: createDependencyDto.sourceTaskId,
          targetTaskId: createDependencyDto.targetTaskId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Dependency already exists between these tasks');
    }

    // Prevent self-dependency
    if (createDependencyDto.sourceTaskId === createDependencyDto.targetTaskId) {
      throw new ConflictException('A task cannot depend on itself');
    }

    return this.prisma.dependency.create({
      data: createDependencyDto,
    });
  }

  async findAll(taskId?: string) {
    const where = taskId
      ? {
          OR: [{ sourceTaskId: taskId }, { targetTaskId: taskId }],
        }
      : {};

    return this.prisma.dependency.findMany({
      where,
      include: {
        sourceTask: { select: { id: true, title: true } },
        targetTask: { select: { id: true, title: true } },
      },
    });
  }

  async findOne(id: string) {
    const dependency = await this.prisma.dependency.findUnique({
      where: { id },
      include: {
        sourceTask: { select: { id: true, title: true } },
        targetTask: { select: { id: true, title: true } },
      },
    });

    if (!dependency) {
      throw new NotFoundException(`Dependency with ID ${id} not found`);
    }

    return dependency;
  }

  async update(id: string, updateDependencyDto: UpdateDependencyDto) {
    return this.prisma.dependency.update({
      where: { id },
      data: updateDependencyDto,
    });
  }

  async remove(id: string) {
    return this.prisma.dependency.delete({
      where: { id },
    });
  }
}
