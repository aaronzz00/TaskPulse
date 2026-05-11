import assert from 'node:assert/strict';
import test from 'node:test';
import { AIService } from './ai.service';

test('createProvider stores an encrypted API key and returns only a preview', async () => {
  const createdRows: any[] = [];
  const prisma = {
    aIProviderConfig: {
      updateMany: async () => ({}),
      create: async (args: any) => {
        createdRows.push(args.data);
        return {
          id: 'provider-1',
          createdAt: new Date('2026-05-10T00:00:00.000Z'),
          updatedAt: new Date('2026-05-10T00:00:00.000Z'),
          ...args.data,
        };
      },
    },
  };
  const service = new AIService(prisma as any, {} as any);

  const provider = await service.createProvider({
    name: 'Orka',
    provider: 'openai-compatible',
    baseUrl: 'https://llm.example.com',
    model: 'gpt-5.4-mini',
    apiKey: 'sk-secret-value',
    isDefault: true,
  });

  assert.equal(provider.apiKeyPreview, 'sk-...alue');
  assert.equal((provider as any).apiKeyEncrypted, undefined);
  assert.notEqual(createdRows[0].apiKeyEncrypted, 'sk-secret-value');
  assert.equal(createdRows[0].isDefault, true);
});

test('chat uses the enabled default database provider before env fallback', async () => {
  process.env.APP_SECRET = 'test-secret';
  const encrypted = AIService.encryptApiKeyForTest('sk-chat-secret');
  const llmCalls: any[] = [];
  const prisma = {
    project: {
      findUnique: async () => ({
        id: 'project-1',
        name: 'Launch',
        description: 'Ship',
        tasks: [{ id: 'task-1', title: 'Build', description: '', status: 'todo' }],
      }),
    },
    aIProviderConfig: {
      findFirst: async () => ({
        id: 'provider-1',
        name: 'DeepSeek',
        provider: 'openai-compatible',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat',
        apiKeyEncrypted: encrypted,
        apiKeyPreview: 'sk-...cret',
        enabled: true,
        isDefault: true,
      }),
    },
  };
  const llmProvider = {
    chatWithConfig: async (prompt: string, config: any) => {
      llmCalls.push({ prompt, config });
      return 'real answer';
    },
    getPreferredProvider: () => 'openai',
    getDefaultModel: () => 'fallback-model',
    getProviderLabel: () => 'openai',
    chat: async () => 'fallback answer',
  };
  const service = new AIService(prisma as any, llmProvider as any);

  const response = await service.chat({ projectId: 'project-1', message: 'status?' });

  assert.equal(response.response, 'real answer');
  assert.equal(response.provider, 'DeepSeek');
  assert.equal(response.model, 'deepseek-chat');
  assert.equal(llmCalls[0].config.apiKey, 'sk-chat-secret');
  assert.match(llmCalls[0].prompt, /Project: Launch/);
});

test('generateProjectInsights uses the enabled default database provider', async () => {
  process.env.APP_SECRET = 'test-secret';
  const encrypted = AIService.encryptApiKeyForTest('sk-insight-secret');
  const llmCalls: any[] = [];
  const prisma = {
    project: {
      findUnique: async () => ({
        id: 'project-1',
        name: 'Launch',
        tasks: [{ id: 'task-1', status: 'todo' }],
      }),
    },
    aIProviderConfig: {
      findFirst: async () => ({
        id: 'provider-1',
        name: 'Qwen',
        provider: 'openai-compatible',
        baseUrl: 'https://dashscope.example.com',
        model: 'qwen-plus',
        apiKeyEncrypted: encrypted,
        apiKeyPreview: 'sk-...cret',
        enabled: true,
        isDefault: true,
      }),
    },
  };
  const llmProvider = {
    chatWithConfig: async (prompt: string, config: any) => {
      llmCalls.push({ prompt, config });
      return 'risk insight';
    },
    getPreferredProvider: () => 'openai',
    getDefaultModel: () => 'fallback-model',
    chat: async () => 'fallback insight',
  };
  const service = new AIService(prisma as any, llmProvider as any);

  const result = await service.generateProjectInsights('project-1');

  assert.equal(result.insights, 'risk insight');
  assert.equal(llmCalls[0].config.model, 'qwen-plus');
  assert.equal(llmCalls[0].config.apiKey, 'sk-insight-secret');
});
