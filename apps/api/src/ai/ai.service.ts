import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { LLMProviderService } from './llm.provider';
import { CreateChatDto, LLMProvider } from './dto/create-chat.dto';
import { AIProviderKind, CreateAIProviderConfigDto } from './dto/ai-provider-config.dto';

export interface ParsedTask {
  title: string;
  description: string;
  estimatedDays: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ParsedProject {
  name: string;
  description: string;
  tasks: ParsedTask[];
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private prisma: PrismaService,
    private llmProvider: LLMProviderService,
  ) {}

  async chat(createChatDto: CreateChatDto) {
    const { projectId, message } = createChatDto;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          select: { id: true, title: true, description: true, status: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const context = this.buildProjectContext(project);
    const prompt = `${context}\n\nUser question: ${message}`;
    const configuredProvider = await this.resolveProviderConfig(createChatDto.providerConfigId);

    if (configuredProvider) {
      this.logger.log(`Processing chat request for project ${projectId} using ${configuredProvider.name}`);
      const response = await this.llmProvider.chatWithConfig(prompt, {
        provider: this.normalizeProviderKind(configuredProvider.provider),
        baseUrl: configuredProvider.baseUrl,
        model: configuredProvider.model,
        apiKey: this.decryptApiKey(configuredProvider.apiKeyEncrypted),
      });

      return {
        response,
        provider: configuredProvider.name,
        model: configuredProvider.model,
        projectId,
      };
    }

    const provider = createChatDto.provider || this.llmProvider.getPreferredProvider();
    const model = createChatDto.model || this.llmProvider.getDefaultModel(provider);

    this.logger.log(`Processing chat request for project ${projectId} using ${provider}`);

    const response = await this.llmProvider.chat(prompt, provider, model);

    return {
      response,
      provider: this.llmProvider.getProviderLabel(provider),
      model,
      projectId,
    };
  }

  async listProviders() {
    const providers = await this.prisma.aIProviderConfig.findMany({
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    return providers.map((provider: any) => this.sanitizeProvider(provider));
  }

  async createProvider(dto: CreateAIProviderConfigDto) {
    if (dto.isDefault) {
      await this.prisma.aIProviderConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const provider = await this.prisma.aIProviderConfig.create({
      data: {
        name: dto.name,
        provider: dto.provider,
        baseUrl: dto.baseUrl || null,
        model: dto.model,
        apiKeyEncrypted: this.encryptApiKey(dto.apiKey),
        apiKeyPreview: this.maskApiKey(dto.apiKey),
        enabled: dto.enabled ?? true,
        isDefault: dto.isDefault ?? false,
      },
    });

    return this.sanitizeProvider(provider);
  }

  async setDefaultProvider(id: string) {
    const provider = await this.prisma.aIProviderConfig.findUnique({ where: { id } });
    if (!provider) {
      throw new NotFoundException(`AI provider config with ID ${id} not found`);
    }

    await this.prisma.aIProviderConfig.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    const updated = await this.prisma.aIProviderConfig.update({
      where: { id },
      data: { isDefault: true, enabled: true },
    });

    return this.sanitizeProvider(updated);
  }

  async testProvider(id: string) {
    const provider = await this.prisma.aIProviderConfig.findUnique({ where: { id } });
    if (!provider) {
      throw new NotFoundException(`AI provider config with ID ${id} not found`);
    }

    await this.llmProvider.chatWithConfig('Reply with ok.', {
      provider: this.normalizeProviderKind(provider.provider),
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKey: this.decryptApiKey(provider.apiKeyEncrypted),
    });

    return { ok: true, message: 'Connection succeeded' };
  }

  async parseProject(conversation: string): Promise<ParsedProject> {
    if (!this.llmProvider.hasAnyProvider()) {
      this.logger.warn('No AI provider configured, using heuristic project parser.');
      return this.buildFallbackProject(conversation);
    }

    const provider = this.llmProvider.getPreferredProvider();
    const model = this.llmProvider.getDefaultModel(provider);
    const prompt = `
You are a project planning assistant. Convert the user's natural language description into strict JSON.

Return JSON only with this shape:
{
  "name": "string",
  "description": "string",
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "estimatedDays": 1,
      "priority": "low" | "medium" | "high" | "critical"
    }
  ]
}

Requirements:
- Produce 4 to 8 tasks.
- Keep estimatedDays as positive integers.
- Use Chinese output if the input is Chinese.
- Do not wrap the JSON in markdown fences.

User description:
${conversation}
    `.trim();

    try {
      const response = await this.llmProvider.chat(prompt, provider, model);
      return this.normalizeParsedProject(this.extractParsedProject(response), conversation);
    } catch (error: any) {
      this.logger.warn(`AI parse failed, falling back to heuristic parser: ${error.message}`);
      return this.buildFallbackProject(conversation);
    }
  }

  private buildProjectContext(project: any): string {
    const tasksSummary = project.tasks
      .map((t: any) => `- [${t.status}] ${t.title}: ${t.description || 'No description'}`)
      .join('\n');

    return `
Project: ${project.name}
Description: ${project.description || 'No description'}

Current tasks in this project:
${tasksSummary || 'No tasks yet'}
    `.trim();
  }

  private async resolveProviderConfig(providerConfigId?: string) {
    if (providerConfigId) {
      const provider = await this.prisma.aIProviderConfig.findUnique({ where: { id: providerConfigId } });
      if (!provider) {
        throw new NotFoundException(`AI provider config with ID ${providerConfigId} not found`);
      }
      return provider.enabled ? provider : null;
    }

    return this.prisma.aIProviderConfig.findFirst({
      where: { enabled: true, isDefault: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private sanitizeProvider(provider: any) {
    const { apiKeyEncrypted: _apiKeyEncrypted, ...safeProvider } = provider;
    return safeProvider;
  }

  private normalizeProviderKind(provider: string): AIProviderKind {
    return provider === 'anthropic' ? 'anthropic' : 'openai-compatible';
  }

  private maskApiKey(apiKey: string) {
    const value = apiKey.trim();
    if (value.length <= 7) {
      return `...${value.slice(-4)}`;
    }

    return `${value.slice(0, 3)}...${value.slice(-4)}`;
  }

  private encryptApiKey(apiKey: string) {
    return AIService.encryptApiKeyForTest(apiKey);
  }

  private decryptApiKey(encrypted: string) {
    const [ivHex, tagHex, encryptedHex] = encrypted.split(':');
    const decipher = createDecipheriv('aes-256-gcm', AIService.encryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  static encryptApiKeyForTest(apiKey: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', AIService.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
  }

  private static encryptionKey() {
    return createHash('sha256')
      .update(process.env.APP_SECRET || 'taskpulse-local-dev-secret')
      .digest();
  }

  async getChatHistory(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return [];
  }

  async generateProjectInsights(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const prompt = `
Analyze this project and provide actionable insights:

Project: ${project.name}
Total tasks: ${project.tasks.length}
Completed tasks: ${project.tasks.filter((t: any) => this.normalizeStatus(t.status) === 'done').length}
In progress: ${project.tasks.filter((t: any) => this.normalizeStatus(t.status) === 'in_progress').length}
Pending: ${project.tasks.filter((t: any) => this.normalizeStatus(t.status) === 'todo').length}

Provide:
1. Progress summary
2. Potential bottlenecks
3. Recommendations for next steps
4. Risk assessment
    `.trim();

    const provider = this.llmProvider.getPreferredProvider();
    const configuredProvider = await this.resolveProviderConfig();
    const response = configuredProvider
      ? await this.llmProvider.chatWithConfig(prompt, {
          provider: this.normalizeProviderKind(configuredProvider.provider),
          baseUrl: configuredProvider.baseUrl,
          model: configuredProvider.model,
          apiKey: this.decryptApiKey(configuredProvider.apiKeyEncrypted),
        })
      : await this.llmProvider.chat(
          prompt,
          provider,
          this.llmProvider.getDefaultModel(provider),
        );

    return {
      insights: response,
      projectId,
      generatedAt: new Date(),
    };
  }

  private extractParsedProject(raw: string): ParsedProject {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('No JSON object found in model response.');
    }

    return JSON.parse(match[0]) as ParsedProject;
  }

  private normalizeParsedProject(parsed: ParsedProject, conversation: string): ParsedProject {
    const fallback = this.buildFallbackProject(conversation);
    const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : fallback.tasks;

    return {
      name: parsed?.name?.trim() || fallback.name,
      description: parsed?.description?.trim() || conversation.trim(),
      tasks: tasks
        .map((task, index) => ({
          title: task?.title?.trim() || fallback.tasks[index % fallback.tasks.length].title,
          description: task?.description?.trim() || '',
          estimatedDays: this.normalizeEstimatedDays(task?.estimatedDays),
          priority: this.normalizePriority(task?.priority),
        }))
        .slice(0, 8),
    };
  }

  private buildFallbackProject(conversation: string): ParsedProject {
    const summary = conversation.trim();
    const baseName = summary.split(/[，。,\n]/)[0]?.trim() || '新项目';

    return {
      name: baseName.length > 40 ? `${baseName.slice(0, 37)}...` : baseName,
      description: summary || '由 ProjectAI 自动创建的项目',
      tasks: [
        { title: '需求梳理', description: '明确范围、目标和验收标准。', estimatedDays: 3, priority: 'high' },
        { title: '方案设计', description: '完成信息架构、技术方案和排期拆解。', estimatedDays: 4, priority: 'high' },
        { title: '核心开发', description: '实现核心功能并打通主流程。', estimatedDays: 10, priority: 'critical' },
        { title: '联调测试', description: '执行集成联调、修复缺陷并验证风险点。', estimatedDays: 5, priority: 'high' },
        { title: '上线准备', description: '准备部署、文档、培训和发布检查项。', estimatedDays: 3, priority: 'medium' },
      ],
    };
  }

  private normalizeEstimatedDays(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 3;
    }

    return Math.max(1, Math.round(parsed));
  }

  private normalizePriority(value: unknown): ParsedTask['priority'] {
    switch (value) {
      case 'low':
      case 'medium':
      case 'high':
      case 'critical':
        return value;
      default:
        return 'medium';
    }
  }

  private normalizeStatus(status?: string): 'todo' | 'in_progress' | 'done' | 'cancelled' {
    switch ((status || '').toLowerCase()) {
      case 'completed':
      case 'done':
        return 'done';
      case 'in_progress':
      case 'in progress':
        return 'in_progress';
      case 'cancelled':
      case 'canceled':
        return 'cancelled';
      default:
        return 'todo';
    }
  }
}
