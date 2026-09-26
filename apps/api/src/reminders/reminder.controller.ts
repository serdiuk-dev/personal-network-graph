import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { CreateContactEventReminderDto } from './dto/create-contact-event-reminder.dto';
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
