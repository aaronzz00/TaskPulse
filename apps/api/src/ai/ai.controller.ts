import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { AIService } from './ai.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { ParseProjectDto } from './dto/parse-project.dto';
import { CreateAIProviderConfigDto } from './dto/ai-provider-config.dto';

@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('chat')
  chat(@Body() createChatDto: CreateChatDto) {
    return this.aiService.chat(createChatDto);
  }

  @Get('providers')
  listProviders() {
    return this.aiService.listProviders();
  }

  @Post('providers')
  createProvider(@Body() dto: CreateAIProviderConfigDto) {
    return this.aiService.createProvider(dto);
  }

  @Post('providers/:id/test')
  testProvider(@Param('id') id: string) {
    return this.aiService.testProvider(id);
  }

  @Post('providers/:id/default')
  setDefaultProvider(@Param('id') id: string) {
    return this.aiService.setDefaultProvider(id);
  }

  @Post('parse-project')
  parseProject(@Body() parseProjectDto: ParseProjectDto) {
    return this.aiService.parseProject(parseProjectDto.conversation);
  }

  @Get('history/:projectId')
  getChatHistory(@Param('projectId') projectId: string) {
    return this.aiService.getChatHistory(projectId);
  }

  @Post('insights/:projectId')
  generateInsights(@Param('projectId') projectId: string) {
    return this.aiService.generateProjectInsights(projectId);
  }
}
