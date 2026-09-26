import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CreateContactEventReminderDto } from './dto/create-contact-event-reminder.dto';
import { UpdateContactEventDto } from './dto/update-contact-event.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { ReminderService } from './reminder.service';

@Controller()
export class ReminderController {
  constructor(
    private readonly reminderService: ReminderService,
  ) {}

  @Post('people/:personId/contact-events')
  create(
    @Param('personId') personId: string,
    @Body() dto: CreateContactEventReminderDto,
  ) {
    return this.reminderService.create(
      personId,
      dto,
    );
  }

  @Get('people/:personId/contact-events')
  findByPerson(
    @Param('personId') personId: string,
  ) {
    return this.reminderService.findByPerson(personId);
  }

  @Patch('contact-events/:id')
  updateEvent(
    @Param('id') id: string,
    @Body() dto: UpdateContactEventDto,
  ) {
    return this.reminderService.updateEvent(id, dto);
  }

  @Patch('reminders/:id')
  updateReminder(
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
  ) {
    return this.reminderService.updateReminder(id, dto);
  }

  @Get('reminders/upcoming')
  findUpcoming() {
    return this.reminderService.findUpcoming();
  }

  @Get('reminders/:id')
  findOne(
    @Param('id') id: string,
  ) {
    return this.reminderService.findOne(id);
  }

  @Delete('reminders/:id')
  removeReminder(
    @Param('id') id: string,
  ) {
    return this.reminderService.removeReminder(id);
  }

  @Delete('contact-events/:id')
  removeEvent(
    @Param('id') id: string,
  ) {
    return this.reminderService.removeEvent(id);
  }
}
