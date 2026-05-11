import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class DuplicateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  copyBaseline?: boolean;
}
