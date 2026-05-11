import { IsString, IsEnum, IsOptional } from 'class-validator';

export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

export class CreateChatDto {
  @IsString()
  projectId: string;

  @IsString()
  message: string;

  @IsEnum(LLMProvider)
  @IsOptional()
  provider?: LLMProvider;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  providerConfigId?: string;
}
