import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export type AIProviderKind = 'openai-compatible' | 'anthropic';

export class CreateAIProviderConfigDto {
  @IsString()
  name: string;

  @IsIn(['openai-compatible', 'anthropic'])
  provider: AIProviderKind;

  @IsString()
  @IsOptional()
  baseUrl?: string;

  @IsString()
  model: string;

  @IsString()
  apiKey: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
