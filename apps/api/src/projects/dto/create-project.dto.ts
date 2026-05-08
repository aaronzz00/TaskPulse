import { IsString, IsNotEmpty, IsDateString, IsEnum, IsOptional } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description: string = '';

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsEnum(['draft', 'active', 'completed', 'archived'])
  @IsOptional()
  status: string = 'draft';
}
