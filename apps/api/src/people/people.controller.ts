import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PeopleService } from './people.service';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Post()
  create(@Body() data: CreatePersonDto) {
    return this.peopleService.create(data);
  }

  @Get()
  findAll() {
    return this.peopleService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.peopleService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() data: UpdatePersonDto,
  ) {
    return this.peopleService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.peopleService.remove(id);
  }

  @Post(':id/categories/:categoryId')
  addCategory(
    @Param('id') id: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.peopleService.addCategory(id, categoryId);
  }

  @Delete(':id/categories/:categoryId')
  removeCategory(
    @Param('id') id: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.peopleService.removeCategory(id, categoryId);
  }

  @Post(':id/interests/:interestId')
  addInterest(
    @Param('id') id: string,
    @Param('interestId') interestId: string,
  ) {
    return this.peopleService.addInterest(id, interestId);
  }

  @Delete(':id/interests/:interestId')
  removeInterest(
    @Param('id') id: string,
    @Param('interestId') interestId: string,
  ) {
    return this.peopleService.removeInterest(id, interestId);
  }
}
