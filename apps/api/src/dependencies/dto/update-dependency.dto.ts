import { PartialType } from '@nestjs/mapped-types';
import { CreateDependencyDto } from './create-dependency.dto';
import { IsEnum, IsOptional, IsNumber } from 'class-validator';

export class UpdateDependencyDto extends PartialType(CreateDependencyDto) {
  @IsEnum(['FS', 'SS', 'FF', 'SF'])
  @IsOptional()
  type?: string;

  @IsNumber()
  @IsOptional()
  lag?: number;

  @IsEnum(['manual', 'ai_suggested', 'ai_confirmed'])
  @IsOptional()
  source?: string;
}
