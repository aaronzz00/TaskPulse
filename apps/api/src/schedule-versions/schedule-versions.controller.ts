import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateScheduleVersionDto } from './dto/create-schedule-version.dto';
import { RestoreScheduleVersionDto } from './dto/restore-schedule-version.dto';
import { ScheduleVersionsService } from './schedule-versions.service';

@Controller('projects/:projectId/schedule-versions')
export class ScheduleVersionsController {
  constructor(private readonly scheduleVersionsService: ScheduleVersionsService) {}

  @Post()
  create(@Param('projectId') projectId: string, @Body() dto: CreateScheduleVersionDto) {
    return this.scheduleVersionsService.createSnapshot(projectId, dto);
  }

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.scheduleVersionsService.findAll(projectId);
  }

  @Post(':versionId/restore')
  restore(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Body() _dto: RestoreScheduleVersionDto,
  ) {
    return this.scheduleVersionsService.restore(projectId, versionId);
  }
}
