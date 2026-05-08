import { IsString, IsNotEmpty } from 'class-validator';

export class ParseProjectDto {
  @IsString()
  @IsNotEmpty()
  conversation: string;
}
