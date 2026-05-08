import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { LLMProviderService } from './llm.provider';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [ConfigModule],
  controllers: [AIController],
  providers: [AIService, LLMProviderService, PrismaService],
  exports: [AIService, LLMProviderService],
})
export class AIModule {}
