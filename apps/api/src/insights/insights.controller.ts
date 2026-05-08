import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { InsightsService } from './insights.service';
import { CreateInsightDto, InsightType } from './dto/create-insight.dto';

@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Post()
  create(@Body() createInsightDto: CreateInsightDto) {
    return this.insightsService.create(createInsightDto);
  }

  @Get()
  findAll(
    @Query('projectId') projectId?: string,
    @Query('type') type?: InsightType,
  ) {
    return this.insightsService.findAll(projectId, type);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.insightsService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.insightsService.remove(id);
  }

  @Post('generate/:projectId')
  generateInsights(@Param('projectId') projectId: string) {
    return this.insightsService.generateProjectInsights(projectId);
  }
}
