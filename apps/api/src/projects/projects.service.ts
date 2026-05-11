import { randomUUID } from 'node:crypto';
import { unlinkSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { DuplicateProjectDto } from './dto/duplicate-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import {
  buildDependencies,
  parseWhisperWorkbook,
  ParsedScheduleRow,
} from '../../scripts/import-whisper-schedule';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(createProjectDto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        ...createProjectDto,
        startDate: new Date(createProjectDto.startDate),
        endDate: new Date(createProjectDto.endDate),
      },
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        tasks: true,
        insights: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project;
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    const data: any = { ...updateProjectDto };
    if (updateProjectDto.startDate) {
      data.startDate = new Date(updateProjectDto.startDate);
    }
    if (updateProjectDto.endDate) {
      data.endDate = new Date(updateProjectDto.endDate);
    }

    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async archive(id: string) {
    return this.prisma.project.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  async duplicate(id: string, duplicateProjectDto: DuplicateProjectDto = {}) {
    const createdProject = await this.prisma.$transaction(async (tx) => {
      const sourceProject = await tx.project.findUnique({
        where: { id },
        include: {
          tasks: {
            include: {
              dependencies: true,
            },
          },
        },
      });

      if (!sourceProject) {
        throw new NotFoundException(`Project with ID ${id} not found`);
      }

      const copy = await tx.project.create({
        data: {
          name: duplicateProjectDto.name ?? `${sourceProject.name} Copy`,
          description: sourceProject.description,
          startDate: sourceProject.startDate,
          endDate: sourceProject.endDate,
          status: 'draft',
        },
      });

      const taskIdMap = new Map<string, string>();

      for (const task of sourceProject.tasks as any[]) {
        const copiedTask = await tx.task.create({
          data: this.toCopiedTaskData(task, copy.id, taskIdMap),
        });
        taskIdMap.set(task.id, copiedTask.id);
      }

      const dependencies = this.getProjectDependencies(sourceProject);
      for (const dependency of dependencies) {
        const sourceTaskId = taskIdMap.get(dependency.sourceTaskId);
        const targetTaskId = taskIdMap.get(dependency.targetTaskId);

        if (!sourceTaskId || !targetTaskId) {
          continue;
        }

        await tx.dependency.create({
          data: {
            sourceTaskId,
            targetTaskId,
            type: dependency.type,
            lag: dependency.lag,
            source: dependency.source,
          },
        });
      }

      return copy;
    });

    return this.findOne(createdProject.id);
  }

  async importExcelScheduleFromFile(file: { buffer: Buffer; originalname?: string }, name?: string) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Excel file is required');
    }

    const extension = extname(file.originalname ?? 'schedule.xlsx') || '.xlsx';
    const tempPath = join(tmpdir(), `taskpulse-import-${randomUUID()}${extension}`);
    writeFileSync(tempPath, file.buffer);

    try {
      const { rows } = parseWhisperWorkbook(tempPath);
      const projectName = name?.trim() || this.projectNameFromFile(file.originalname);
      return this.importParsedScheduleRows(projectName, rows);
    } finally {
      try {
        unlinkSync(tempPath);
      } catch {
        // Temporary files should not block the import response.
      }
    }
  }

  async importParsedScheduleRows(name: string, rows: ParsedScheduleRow[]) {
    if (!rows.length) {
      throw new BadRequestException('Excel workbook did not contain schedule rows');
    }

    const projectStart = this.minIso(rows.map((row) => row.startIso));
    const projectEnd = this.maxIso(rows.map((row) => row.endIso));
    const dependencies = buildDependencies(rows);
    const createdProject = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name,
          description: 'Imported schedule from Excel workbook',
          startDate: new Date(projectStart),
          endDate: new Date(projectEnd),
          status: 'active',
        },
      });

      const taskIdMap = new Map<string, string>();
      for (const row of rows) {
        const task = await tx.task.create({
          data: {
            projectId: project.id,
            displayId: `W-${String(row.rowNumber).padStart(3, '0')}`,
            parentId: row.parentId ? taskIdMap.get(row.parentId) ?? null : null,
            title: row.title,
            description: '',
            status: 'todo',
            plannedStart: new Date(row.startIso ?? projectStart),
            plannedEnd: new Date(row.endIso ?? row.startIso ?? projectStart),
            priority: 'medium',
            progress: 0,
          },
        });
        taskIdMap.set(row.id, task.id);
      }

      for (const dependency of dependencies) {
        const sourceTaskId = taskIdMap.get(dependency.sourceTaskId);
        const targetTaskId = taskIdMap.get(dependency.targetTaskId);
        if (!sourceTaskId || !targetTaskId) {
          continue;
        }

        await tx.dependency.create({
          data: {
            sourceTaskId,
            targetTaskId,
            type: dependency.type,
            lag: dependency.lag,
            source: 'imported',
          },
        });
      }

      return project;
    });

    return this.findOne(createdProject.id);
  }

  async remove(id: string) {
    return this.prisma.project.delete({
      where: { id },
    });
  }

  private toCopiedTaskData(task: any, projectId: string, taskIdMap: Map<string, string>) {
    return {
      projectId,
      displayId: task.displayId,
      parentId: task.parentId ? taskIdMap.get(task.parentId) ?? null : null,
      title: task.title,
      description: task.description,
      status: task.status,
      assigneeId: task.assigneeId,
      plannedStart: task.plannedStart,
      plannedEnd: task.plannedEnd,
      actualStart: task.actualStart,
      actualEnd: task.actualEnd,
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      priority: task.priority,
      progress: task.progress,
      aiConfidence: task.aiConfidence,
      aiReasoning: task.aiReasoning,
    };
  }

  private getProjectDependencies(sourceProject: any) {
    const dependencies = sourceProject.dependencies ?? sourceProject.tasks.flatMap((task: any) => task.dependencies ?? []);
    const seen = new Set<string>();

    return dependencies.filter((dependency: any) => {
      const key = `${dependency.sourceTaskId}:${dependency.targetTaskId}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private projectNameFromFile(originalname?: string) {
    const filename = originalname ? basename(originalname, extname(originalname)) : '';
    return filename || 'Imported Project';
  }

  private minIso(values: Array<string | null>) {
    const concrete = values.filter((value): value is string => Boolean(value)).sort();
    return concrete[0] ?? new Date().toISOString();
  }

  private maxIso(values: Array<string | null>) {
    const concrete = values.filter((value): value is string => Boolean(value)).sort();
    return concrete[concrete.length - 1] ?? new Date().toISOString();
  }
}
