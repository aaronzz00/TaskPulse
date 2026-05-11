import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateScheduleVersionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['manual', 'baseline', 'imported', 'auto', 'rollback'])
  type?: string;

  @IsOptional()
  @IsBoolean()
  isBaseline?: boolean;
}
