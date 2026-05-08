import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { AIService } from './ai.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { ParseProjectDto } from './dto/parse-project.dto';

@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('chat')
  chat(@Body() createChatDto: CreateChatDto) {
    return this.aiService.chat(createChatDto);
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
