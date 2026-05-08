import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';
import { IsString, IsDateString, IsEnum, IsOptional, IsNumber } from 'class-validator';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['todo', 'in_progress', 'done', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsDateString()
  @IsOptional()
  plannedStart?: string;

  @IsDateString()
  @IsOptional()
  plannedEnd?: string;

  @IsDateString()
  @IsOptional()
  actualStart?: string;

  @IsDateString()
  @IsOptional()
  actualEnd?: string;

  @IsNumber()
  @IsOptional()
  estimatedHours?: number;

  @IsNumber()
  @IsOptional()
  actualHours?: number;

  @IsEnum(['low', 'medium', 'high', 'critical'])
  @IsOptional()
  priority?: string;

  @IsNumber()
  @IsOptional()
  progress?: number;
}
