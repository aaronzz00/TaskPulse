import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [InsightsController],
  providers: [InsightsService, PrismaService],
  exports: [InsightsService],
})
export class InsightsModule {}
