import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber } from 'class-validator';

export class CreateDependencyDto {
  @IsString()
  @IsNotEmpty()
  sourceTaskId: string;

  @IsString()
  @IsNotEmpty()
  targetTaskId: string;

  @IsEnum(['FS', 'SS', 'FF', 'SF'])
  @IsOptional()
  type: string = 'FS';

  @IsNumber()
  @IsOptional()
  lag: number = 0;

  @IsEnum(['manual', 'ai_suggested', 'ai_confirmed'])
  @IsOptional()
  source: string = 'manual';
}
