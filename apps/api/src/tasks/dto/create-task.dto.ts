import { IsString, IsNotEmpty, IsDateString, IsEnum, IsOptional, IsNumber } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsOptional()
  displayId?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description: string = '';

  @IsEnum(['todo', 'in_progress', 'done', 'cancelled'])
  @IsOptional()
  status: string = 'todo';

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsDateString()
  @IsNotEmpty()
  plannedStart: string;

  @IsDateString()
  @IsNotEmpty()
  plannedEnd: string;

  @IsDateString()
  @IsOptional()
  actualStart?: string;

  @IsDateString()
  @IsOptional()
  actualEnd?: string;

  @IsNumber()
  @IsOptional()
  estimatedHours: number = 0;

  @IsNumber()
  @IsOptional()
  actualHours: number = 0;

  @IsEnum(['low', 'medium', 'high', 'critical'])
  @IsOptional()
  priority: string = 'medium';

  @IsNumber()
  @IsOptional()
  progress: number = 0;
}
