import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { DuplicateProjectDto } from './dto/duplicate-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(@UploadedFile() file: any, @Body('name') name?: string) {
    return this.projectsService.importExcelScheduleFromFile(file, name);
  }

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.projectsService.archive(id);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Body() duplicateProjectDto: DuplicateProjectDto) {
    return this.projectsService.duplicate(id, duplicateProjectDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
