import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { LLMProviderService } from './llm.provider';
import { CreateChatDto, LLMProvider } from './dto/create-chat.dto';

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
    const provider = createChatDto.provider || this.llmProvider.getPreferredProvider();
    const model = createChatDto.model || this.llmProvider.getDefaultModel(provider);
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

    this.logger.log(`Processing chat request for project ${projectId} using ${provider}`);

    const response = await this.llmProvider.chat(prompt, provider, model);

    return {
      response,
      provider: this.llmProvider.getProviderLabel(provider),
      model,
      projectId,
    };
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
    const response = await this.llmProvider.chat(
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
