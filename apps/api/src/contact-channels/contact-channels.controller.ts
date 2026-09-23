import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { ContactChannelsService } from './contact-channels.service';
import { CreateContactChannelDto } from './dto/create-contact-channel.dto';
import { UpdateContactChannelDto } from './dto/update-contact-channel.dto';

@Controller()
export class ContactChannelsController {
  constructor(
    private readonly contactChannelsService:
      ContactChannelsService,
  ) {}

  @Post(
    'people/:personId/contact-channels',
  )
  create(
    @Param('personId')
    personId: string,
    @Body()
    data: CreateContactChannelDto,
  ) {
    return this.contactChannelsService.create(
      personId,
      data,
    );
  }

  @Get(
    'people/:personId/contact-channels',
  )
  findForPerson(
    @Param('personId')
    personId: string,
  ) {
    return this.contactChannelsService.findForPerson(
      personId,
    );
  }

  @Get('contact-channels/:id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.contactChannelsService.findOne(
      id,
    );
  }

  @Patch('contact-channels/:id')
  update(
    @Param('id')
    id: string,
    @Body()
    data: UpdateContactChannelDto,
  ) {
    return this.contactChannelsService.update(
      id,
      data,
    );
  }

  @Delete('contact-channels/:id')
  remove(
    @Param('id')
    id: string,
  ) {
    return this.contactChannelsService.remove(
      id,
    );
  }
}
