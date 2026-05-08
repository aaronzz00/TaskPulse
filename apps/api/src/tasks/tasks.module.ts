import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaService } from '../common/prisma.service';
import { SchedulingService } from './scheduling.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService, PrismaService, SchedulingService],
  exports: [TasksService, SchedulingService],
})
export class TasksModule {}
