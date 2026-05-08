import { IsString, IsEnum, IsOptional, IsJSON } from 'class-validator';

export enum InsightType {
  PROGRESS = 'PROGRESS',
  BOTTLENECK = 'BOTTLENECK',
  RECOMMENDATION = 'RECOMMENDATION',
  RISK = 'RISK',
  SUMMARY = 'SUMMARY',
}

export class CreateInsightDto {
  @IsString()
  projectId: string;

  @IsEnum(InsightType)
  type: InsightType;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  reasoning?: string;
}
