import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { UpdateRelationshipDto } from './dto/update-relationship.dto';
import { RelationshipsService } from './relationships.service';

@Controller('relationships')
export class RelationshipsController {
  constructor(
    private readonly relationshipsService: RelationshipsService,
  ) {}

  @Post()
  create(@Body() data: CreateRelationshipDto) {
    return this.relationshipsService.create(data);
  }

  @Get()
  findAll() {
    return this.relationshipsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.relationshipsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() data: UpdateRelationshipDto,
  ) {
    return this.relationshipsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.relationshipsService.remove(id);
  }
}
