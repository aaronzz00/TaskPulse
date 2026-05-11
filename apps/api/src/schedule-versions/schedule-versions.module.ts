import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ScheduleVersionsController } from './schedule-versions.controller';
import { ScheduleVersionsService } from './schedule-versions.service';

@Module({
  controllers: [ScheduleVersionsController],
  providers: [PrismaService, ScheduleVersionsService],
})
export class ScheduleVersionsModule {}
