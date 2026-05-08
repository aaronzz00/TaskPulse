import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider } from './dto/create-chat.dto';

@Injectable()
export class LLMProviderService {
  private readonly logger = new Logger(LLMProviderService.name);
  private openaiClient: OpenAI;
  private anthropicClient: Anthropic;
  private openaiMode: 'openai' | 'orka' | null = null;
  private readonly defaultOpenAIModel: string;
  private readonly defaultAnthropicModel: string;

  constructor(private configService: ConfigService) {
    const openaiApiKey = this.getConfiguredSecret('OPENAI_API_KEY');
    const anthropicApiKey = this.getConfiguredSecret('ANTHROPIC_API_KEY');
    const orkaApiKey = this.getConfiguredSecret('ORKA_API_KEY');
    const orkaBaseUrl =
      this.configService.get<string>('ORKA_BASE_URL') || 'https://llm.hiorka.com';

    this.defaultOpenAIModel =
      this.configService.get<string>('OPENAI_MODEL') ||
      this.configService.get<string>('ORKA_MODEL') ||
      'gpt-5.4-mini';
    this.defaultAnthropicModel =
      this.configService.get<string>('ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022';

    if (openaiApiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
      this.openaiMode = 'openai';
    } else if (orkaApiKey) {
      this.openaiClient = new OpenAI({
        apiKey: orkaApiKey,
        baseURL: orkaBaseUrl,
      });
      this.openaiMode = 'orka';
    }

    if (anthropicApiKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
    }
  }

  async chatWithOpenAI(
    message: string,
    model: string = this.defaultOpenAIModel,
  ): Promise<string> {
    if (!this.openaiClient) {
      throw new Error(
        'OpenAI-compatible client is not initialized. Check OPENAI_API_KEY or ORKA_API_KEY.',
      );
    }

    try {
      const response = await this.openaiClient.chat.completions.create({
        model,
        messages: [{ role: 'user', content: message }],
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error(`OpenAI error: ${error.message}`);
      throw error;
    }
  }

  async chatWithAnthropic(
    message: string,
    model: string = this.defaultAnthropicModel,
  ): Promise<string> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client is not initialized. Check ANTHROPIC_API_KEY.');
    }

    try {
      const response = await (this.anthropicClient as any).messages.create({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: message }],
      });

      const content = response.content[0];
      return content.type === 'text' ? content.text : '';
    } catch (error) {
      this.logger.error(`Anthropic error: ${error.message}`);
      throw error;
    }
  }

  async chat(
    message: string,
    provider: LLMProvider = LLMProvider.OPENAI,
    model?: string,
  ): Promise<string> {
    switch (provider) {
      case LLMProvider.OPENAI:
        return this.chatWithOpenAI(message, model);
      case LLMProvider.ANTHROPIC:
        return this.chatWithAnthropic(message, model);
      default:
        return this.chatWithOpenAI(message, model);
    }
  }

  isProviderAvailable(provider: LLMProvider): boolean {
    switch (provider) {
      case LLMProvider.OPENAI:
        return !!this.openaiClient;
      case LLMProvider.ANTHROPIC:
        return !!this.anthropicClient;
      default:
        return false;
    }
  }

  hasAnyProvider(): boolean {
    return !!this.openaiClient || !!this.anthropicClient;
  }

  getPreferredProvider(): LLMProvider {
    if (this.openaiClient) {
      return LLMProvider.OPENAI;
    }

    if (this.anthropicClient) {
      return LLMProvider.ANTHROPIC;
    }

    return LLMProvider.OPENAI;
  }

  getDefaultModel(provider: LLMProvider): string {
    switch (provider) {
      case LLMProvider.ANTHROPIC:
        return this.defaultAnthropicModel;
      case LLMProvider.OPENAI:
      default:
        return this.defaultOpenAIModel;
    }
  }

  getProviderLabel(provider: LLMProvider): string {
    if (provider === LLMProvider.OPENAI && this.openaiMode === 'orka') {
      return 'orka';
    }

    return provider;
  }

  private getConfiguredSecret(name: string): string | undefined {
    const value = this.configService.get<string>(name)?.trim();
    if (!value) {
      return undefined;
    }

    const normalized = value.toLowerCase();
    const placeholderPatterns = [
      'your_',
      'your-',
      '_here',
      '-here',
      'replace_me',
      'changeme',
      'example',
    ];

    if (placeholderPatterns.some((pattern) => normalized.includes(pattern))) {
      return undefined;
    }

    return value;
  }
}
