import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { DependenciesModule } from './dependencies/dependencies.module';
import { InsightsModule } from './insights/insights.module';
import { AIModule } from './ai/ai.module';
import { WebSocketModule } from './websocket/websocket.module';
import { PrismaService } from './common/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ProjectsModule,
    TasksModule,
    DependenciesModule,
    InsightsModule,
    AIModule,
    WebSocketModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
