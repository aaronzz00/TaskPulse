import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { UpdateTaskDto } from './update-task.dto';

export class BatchTaskUpdateItemDto extends UpdateTaskDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class BatchUpdateTaskDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchTaskUpdateItemDto)
  tasks: BatchTaskUpdateItemDto[];
}
